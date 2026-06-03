import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Gift, Search, MoreHorizontal, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { brl } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { OrderBumpModal, type OrderBumpInput } from "@/components/OrderBumpModal";

export const Route = createFileRoute("/app/order-bumps/")({
  component: OrderBumpsList,
});

type BumpRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  productId: string | null;
  productName: string | null;
};

function OrderBumpsList() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrderBumpInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BumpRow | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["order_bumps", "list"],
    queryFn: async (): Promise<BumpRow[]> => {
      const { data, error } = await supabase
        .from("order_bumps")
        .select("id,title,description,price,compare_at_price,product_id")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = data ?? [];
      const productIds = Array.from(
        new Set(rows.map((r) => r.product_id as string | null).filter(Boolean) as string[]),
      );
      let nameMap: Record<string, string> = {};
      if (productIds.length) {
        const { data: prods } = await supabase
          .from("products")
          .select("id,name")
          .in("id", productIds);
        nameMap = Object.fromEntries((prods ?? []).map((p) => [p.id as string, p.name as string]));
      }

      return rows.map((r) => {
        const pid = (r.product_id as string | null) ?? null;
        return {
          id: r.id as string,
          title: (r.title as string) ?? (pid ? nameMap[pid] ?? "" : ""),
          description: (r.description as string) ?? "",
          price: Number(r.price),
          compareAtPrice: r.compare_at_price == null ? null : Number(r.compare_at_price),
          productId: pid,
          productName: pid ? nameMap[pid] ?? null : null,
        };
      });
    },
  });

  const linksQ = useQuery({
    queryKey: ["checkouts", "by-bump"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("checkouts")
        .select("order_bump_id")
        .not("order_bump_id", "is", null);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        const id = r.order_bump_id as string | null;
        if (id) map[id] = (map[id] ?? 0) + 1;
      });
      return map;
    },
  });

  const links = linksQ.data ?? {};
  const items = q.data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.productName?.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q),
    );
  }, [items, query]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleAll = () =>
    setSelected((s) =>
      s.size === filtered.length ? new Set() : new Set(filtered.map((b) => b.id)),
    );

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  const deleteM = useMutation({
    mutationFn: async (bump: BumpRow) => {
      const { error: unlinkErr } = await supabase
        .from("checkouts")
        .update({ order_bump_id: null })
        .eq("order_bump_id", bump.id);
      if (unlinkErr) throw unlinkErr;
      const { error } = await supabase.from("order_bumps").delete().eq("id", bump.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order_bumps"] });
      qc.invalidateQueries({ queryKey: ["order_bumps", "list"] });
      qc.invalidateQueries({ queryKey: ["checkouts"] });
      qc.invalidateQueries({ queryKey: ["checkouts", "by-bump"] });
      toast.success("Order bump excluído");
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (b: BumpRow) => {
    setEditing({
      id: b.id,
      productId: b.productId ?? undefined,
      description: b.description,
      price: b.price,
      compareAtPrice: b.compareAtPrice,
    });
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="h-6 w-6" /> Order bumps
          </h1>
          <p className="text-sm text-muted-foreground">
            Oferta extra no checkout vinculada a um produto — entrega automática após o pagamento.
          </p>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-primary to-[oklch(0.68_0.22_300)]">
          <Plus className="h-4 w-4 mr-2" /> Novo bump
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-card/60"
          />
        </div>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground py-10 text-center">Carregando...</div>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center space-y-3">
            <Gift className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Você ainda não criou nenhum order bump.
            </p>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> Criar o primeiro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl bg-card/60 backdrop-blur border-border/60 overflow-hidden">
          <div className="hidden md:grid grid-cols-[40px_minmax(0,3fr)_120px_100px_100px_120px] gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-background/40">
            <button
              onClick={toggleAll}
              aria-label="Selecionar todos"
              className={`h-4 w-4 rounded border ${allSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}
            />
            <span>Bump</span>
            <span>Preço</span>
            <span>Checkouts</span>
            <span>Status</span>
            <span className="text-right">Ações</span>
          </div>

          <ul className="divide-y divide-border/40">
            {filtered.map((b) => {
              const isSel = selected.has(b.id);
              const used = links[b.id] ?? 0;
              const label = b.productName ?? b.title ?? "Produto removido";

              return (
                <li
                  key={b.id}
                  className={`grid grid-cols-[40px_1fr] md:grid-cols-[40px_minmax(0,3fr)_120px_100px_100px_120px] gap-4 px-5 py-4 items-center transition-colors hover:bg-primary/5 ${isSel ? "bg-primary/5" : ""}`}
                >
                  <button
                    onClick={() => toggle(b.id)}
                    aria-label="Selecionar"
                    className={`h-4 w-4 rounded border transition ${isSel ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary"}`}
                  />

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-border/60">
                      <Gift className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{label}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          ID: {b.id.slice(-6).toUpperCase()}
                        </span>
                        {b.description && (
                          <span className="text-[10px] truncate max-w-[150px] text-muted-foreground italic">
                            — {b.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="md:hidden col-span-2 flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="secondary">{brl(b.price)}</Badge>
                    <Badge variant="outline">{used} checkouts</Badge>
                    {!b.productId && <Badge variant="destructive">Sem produto</Badge>}
                    <div className="ml-auto">
                      <BumpActions
                        onEdit={() => openEdit(b)}
                        onDelete={() => setConfirmDelete(b)}
                      />
                    </div>
                  </div>

                  <div className="hidden md:block tabular-nums text-sm font-medium">
                    {brl(b.price)}
                    {b.compareAtPrice != null && (
                      <div className="text-[10px] line-through text-muted-foreground font-normal">
                        {brl(b.compareAtPrice)}
                      </div>
                    )}
                  </div>

                  <div className="hidden md:block tabular-nums text-sm">
                    {used}
                  </div>

                  <div className="hidden md:block">
                    {b.productId ? (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Inativo
                      </span>
                    )}
                  </div>

                  <div className="hidden md:flex justify-end">
                    <BumpActions
                      onEdit={() => openEdit(b)}
                      onDelete={() => setConfirmDelete(b)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum order bump encontrado para "{query}".
            </div>
          )}
        </Card>
      ) }

      <OrderBumpModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={editing}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir order bump?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && (links[confirmDelete.id] ?? 0) > 0
                ? `Este bump está vinculado a ${links[confirmDelete.id]} checkout(s). Ao excluir, ele será desvinculado automaticamente.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) deleteM.mutate(confirmDelete);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BumpActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
