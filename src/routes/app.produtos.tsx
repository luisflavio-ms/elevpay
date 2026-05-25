import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Package, Copy, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl, db, seedIfNeeded, uid } from "@/lib/store";
import type { Product, ProductType } from "@/lib/types";

export const Route = createFileRoute("/app/produtos")({
  component: ProdutosPage,
});

const empty: Product = {
  id: "",
  name: "",
  description: "",
  price: 0,
  image: "",
  type: "digital",
  deliveryUrl: "",
};

const typeLabel: Record<ProductType, string> = {
  digital: "Digital",
  fisico: "Físico",
  assinatura: "Assinatura",
};

function ProdutosPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Product>(empty);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    seedIfNeeded();
    setItems(db.getProducts());
  }, []);

  const orders = useMemo(() => db.getOrders(), [items]);
  const checkouts = useMemo(() => db.getCheckouts(), [items]);

  const salesByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "aprovado") map.set(o.productId, (map.get(o.productId) ?? 0) + 1);
    }
    return map;
  }, [orders]);

  const slugByProduct = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of checkouts) if (!map.has(c.productId)) map.set(c.productId, c.slug);
    return map;
  }, [checkouts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [items, query]);

  const persist = (next: Product[]) => {
    setItems(next);
    db.setProducts(next);
  };

  const save = () => {
    if (!draft.name.trim()) return toast.error("Nome é obrigatório");
    const isNew = !draft.id;
    const item = isNew ? { ...draft, id: uid("p") } : draft;
    const next = isNew ? [...items, item] : items.map((p) => (p.id === item.id ? item : p));
    persist(next);
    setOpen(false);
    toast.success(isNew ? "Produto criado" : "Produto atualizado");
  };

  const remove = (id: string) => {
    persist(items.filter((p) => p.id !== id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    toast.success("Produto excluído");
  };

  const removeMany = () => {
    persist(items.filter((p) => !selected.has(p.id)));
    toast.success(`${selected.size} produtos excluídos`);
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleAll = () =>
    setSelected((s) => (s.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id))));

  const openNew = () => {
    setDraft(empty);
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setDraft(p);
    setOpen(true);
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/checkout/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu catálogo de ofertas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-gradient-to-r from-primary to-[oklch(0.68_0.22_300)]">
              <Plus className="h-4 w-4 mr-2" /> Novo produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{draft.id ? "Editar produto" : "Novo produto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Field label="Nome">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Descrição curta">
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço (R$)">
                  <Input
                    type="number"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Tipo">
                  <Select
                    value={draft.type}
                    onValueChange={(v) => setDraft({ ...draft, type: v as ProductType })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="digital">Digital</SelectItem>
                      <SelectItem value="fisico">Físico</SelectItem>
                      <SelectItem value="assinatura">Assinatura</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="URL da imagem">
                <Input value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} />
              </Field>
              <Field label="URL de entrega">
                <Input value={draft.deliveryUrl} onChange={(e) => setDraft({ ...draft, deliveryUrl: e.target.value })} />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
          <Button variant="outline" onClick={removeMany} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Excluir ({selected.size})
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState onAction={openNew} />
      ) : (
        <Card className="rounded-2xl bg-card/60 backdrop-blur border-border/60 overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[40px_minmax(0,3fr)_120px_110px_80px_minmax(0,1.5fr)_120px] gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-background/40">
            <button
              onClick={toggleAll}
              aria-label="Selecionar todos"
              className={`h-4 w-4 rounded border ${allSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}
            />
            <span>Produto</span>
            <span>Preço</span>
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
              const url = slug ? `${window.location.origin}/checkout/${slug}` : "—";

              return (
                <li
                  key={p.id}
                  className={`grid grid-cols-[40px_1fr] md:grid-cols-[40px_minmax(0,3fr)_120px_110px_80px_minmax(0,1.5fr)_120px] gap-4 px-5 py-4 items-center transition-colors hover:bg-primary/5 ${isSel ? "bg-primary/5" : ""}`}
                >
                  <button
                    onClick={() => toggle(p.id)}
                    aria-label="Selecionar"
                    className={`h-4 w-4 rounded border transition ${isSel ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary"}`}
                  />

                  {/* Product cell */}
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

                  {/* Mobile-only block */}
                  <div className="md:hidden col-span-2 flex flex-wrap items-center gap-2 pt-1">
                    <span className="font-semibold text-primary">{brl(p.price)}</span>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">Ativo</Badge>
                    <span className="text-xs text-muted-foreground">{sales} vendas</span>
                    <div className="ml-auto flex gap-1">
                      {slug && (
                        <Button size="icon" variant="ghost" onClick={() => copyLink(slug)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Desktop columns */}
                  <div className="hidden md:block font-semibold text-primary tabular-nums">{brl(p.price)}</div>
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
                      onClick={() => copyLink(slug ?? "")}
                      disabled={!slug}
                      className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-30"
                      aria-label="Duplicar link"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
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
