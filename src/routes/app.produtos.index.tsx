import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package, Copy, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
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
import { brl } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

import type { ProductType } from "@/lib/types";
import { checkoutOrigin } from "@/lib/domains";

export const Route = createFileRoute("/app/produtos/")({
  component: ProdutosPage,
});

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  image: string | null;
  type: ProductType;
  delivery_url: string | null;
};

const typeLabel: Record<ProductType, string> = {
  digital: "Digital",
  fisico: "Físico",
  assinatura: "Assinatura",
};

function ProdutosPage() {
  const qc = useQueryClient();
  const nav = useNavigate();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id,user_id,name,description,image,type,delivery_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const checkoutsQ = useQuery({
    queryKey: ["checkouts", "slug-by-product"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkouts")
        .select("product_id,public_id")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const salesQ = useQuery({
    queryKey: ["orders", "approved-count-by-product"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("product_id,status")
        .eq("status", "aprovado");
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = productsQ.data ?? [];

  const salesByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of salesQ.data ?? []) {
      if (!o.product_id) continue;
      map.set(o.product_id, (map.get(o.product_id) ?? 0) + 1);
    }
    return map;
  }, [salesQ.data]);

  const slugByProduct = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of checkoutsQ.data ?? []) {
      if (c.product_id && !map.has(c.product_id)) map.set(c.product_id, c.public_id);
    }
    return map;
  }, [checkoutsQ.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    );
  }, [items, query]);

  const deleteM = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setSelected((s) => {
        const n = new Set(s);
        ids.forEach((id) => n.delete(id));
        return n;
      });
      toast.success(ids.length > 1 ? `${ids.length} produtos excluídos` : "Produto excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleAll = () =>
    setSelected((s) =>
      s.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)),
    );

  const openNew = () => nav({ to: "/app/produtos/$id", params: { id: "new" } });
  const openEdit = (p: ProductRow) =>
    nav({ to: "/app/produtos/$id", params: { id: p.id } });

  const copyLink = (slug: string) => {
    const url = `${checkoutOrigin()}/checkout/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const duplicateM = useMutation({
    mutationFn: async (productId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Não autenticado");

      // 1. duplicar produto
      const { data: orig, error: pErr } = await supabase
        .from("products")
        .select("name,description,image,type,delivery_url")
        .eq("id", productId)
        .single();
      if (pErr || !orig) throw pErr ?? new Error("Produto não encontrado");

      const { data: newProd, error: insPErr } = await supabase
        .from("products")
        .insert({
          user_id: uid,
          name: `${orig.name} (cópia)`,
          description: orig.description,
          image: orig.image,
          type: orig.type,
          delivery_url: orig.delivery_url,
        })
        .select("id")
        .single();
      if (insPErr || !newProd) throw insPErr ?? new Error("Falha ao duplicar produto");

      // 2. duplicar checkout(s) vinculados
      const { data: cks } = await supabase
        .from("checkouts")
        .select("name,headline,subheadline,image,benefits,testimonials,blocks,payment_methods,button_text,primary_color,guarantee,urgency_message,secure_seal,scarcity_timer_minutes,redirect_url,webhook_url,pixel_google,pixel_meta,amount,active,order_bump_id")
        .eq("product_id", productId)
        .limit(1);

      if (cks && cks.length > 0) {
        const ck = cks[0];
        await supabase.from("checkouts").insert({
          ...ck,
          user_id: uid,
          product_id: newProd.id,
          name: `${ck.name} (cópia)`,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["checkouts", "slug-by-product"] });
      toast.success("Produto e checkout duplicados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  if (productsQ.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (productsQ.error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-destructive">Erro: {(productsQ.error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu catálogo de ofertas</p>
        </div>
        <Link to="/app/produtos/$id" params={{ id: "new" }}>
          <Button className="bg-gradient-to-r from-primary to-[oklch(0.68_0.22_300)]">
            <Plus className="h-4 w-4 mr-2" /> Novo produto
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-card/60"
          />
        </div>
        {selected.size > 0 && (
          <Button variant="outline" onClick={() => deleteM.mutate(Array.from(selected))} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Excluir ({selected.size})
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState onAction={openNew} />
      ) : (
        <Card className="rounded-2xl bg-card/60 backdrop-blur border-border/60 overflow-hidden">
          <div className="hidden md:grid grid-cols-[40px_minmax(0,3fr)_110px_80px_minmax(0,1.5fr)_120px] gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-background/40">
            <button
              onClick={toggleAll}
              aria-label="Selecionar todos"
              className={`h-4 w-4 rounded border ${allSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}
            />
            <span>Produto</span>
            <span>Status</span>
            <span>Vendas</span>
            <span>Link</span>
            <span className="text-right">Ações</span>
          </div>

          <ul className="divide-y divide-border/40">
            {filtered.map((p) => {
              const isSel = selected.has(p.id);
              const sales = salesByProduct.get(p.id) ?? 0;
              const slug = slugByProduct.get(p.id);
              const url = slug ? `${checkoutOrigin()}/checkout/${slug}` : "—";

              return (
                <li
                  key={p.id}
                  className={`grid grid-cols-[40px_1fr] md:grid-cols-[40px_minmax(0,3fr)_110px_80px_minmax(0,1.5fr)_120px] gap-4 px-5 py-4 items-center transition-colors hover:bg-primary/5 ${isSel ? "bg-primary/5" : ""}`}
                >
                  <button
                    onClick={() => toggle(p.id)}
                    aria-label="Selecionar"
                    className={`h-4 w-4 rounded border transition ${isSel ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary"}`}
                  />

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-border/60">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          ID: {p.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                          {typeLabel[p.type]}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="md:hidden col-span-2 flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">Ativo</Badge>
                    <span className="text-xs text-muted-foreground">{sales} vendas</span>
                    <div className="ml-auto flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => duplicateM.mutate(p.id)} disabled={duplicateM.isPending}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteM.mutate([p.id])}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  
                  <div className="hidden md:block">
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ativo
                    </span>
                  </div>
                  <div className="hidden md:block tabular-nums text-sm">{sales}</div>
                  <div className="hidden md:flex items-center gap-2 min-w-0">
                    {slug ? (
                      <>
                        <div className="flex items-center gap-1.5 min-w-0 px-2.5 py-1 rounded-md bg-background/60 border border-border/60">
                          <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-xs truncate text-muted-foreground">{url.replace(/^https?:\/\//, "")}</span>
                        </div>
                        <button
                          onClick={() => copyLink(slug)}
                          className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                          aria-label="Copiar link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">sem checkout</span>
                    )}
                  </div>
                  <div className="hidden md:flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      className="h-8 w-8 grid place-items-center rounded-md text-primary hover:bg-primary/10 transition"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => duplicateM.mutate(p.id)}
                      disabled={duplicateM.isPending}
                      className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-30"
                      aria-label="Duplicar produto e checkout"
                      title="Duplicar produto e checkout"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteM.mutate([p.id])}
                      className="h-8 w-8 grid place-items-center rounded-md text-destructive hover:bg-destructive/10 transition"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado para "{query}".
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="py-16 text-center">
        <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">Nenhum produto cadastrado</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Crie seu primeiro produto para começar a vender.
        </p>
        <Button onClick={onAction}>
          <Plus className="h-4 w-4 mr-2" /> Criar produto
        </Button>
      </CardContent>
    </Card>
  );
}

