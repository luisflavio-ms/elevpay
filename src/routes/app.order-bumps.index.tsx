import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
};

function OrderBumpsList() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrderBumpInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BumpRow | null>(null);

  const q = useQuery({
    queryKey: ["order_bumps", "list"],
    queryFn: async (): Promise<BumpRow[]> => {
      const { data, error } = await supabase
        .from("order_bumps")
        .select("id,title,description,price")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        description: (r.description as string) ?? "",
        price: Number(r.price),
      }));
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

  const deleteM = useMutation({
    mutationFn: async (bump: BumpRow) => {
      // Desvincula dos checkouts antes de remover
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
    setEditing({ id: b.id, title: b.title, description: b.description, price: b.price });
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="h-6 w-6" /> Order bumps
          </h1>
          <p className="text-sm text-muted-foreground">
            Ofertas adicionais exibidas no checkout. O preço é validado no servidor.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Novo bump
        </Button>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground py-10 text-center">Carregando...</div>
      ) : items.length === 0 ? (
        <Card>
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
        <div className="grid gap-3">
          {items.map((b) => {
            const used = links[b.id] ?? 0;
            return (
              <Card key={b.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{b.title}</h3>
                      <Badge variant="secondary">{brl(b.price)}</Badge>
                      {used > 0 && (
                        <Badge variant="outline">
                          {used} checkout{used > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    {b.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {b.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDelete(b)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
