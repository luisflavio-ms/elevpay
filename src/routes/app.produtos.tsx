import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function ProdutosPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Product>(empty);

  useEffect(() => {
    seedIfNeeded();
    setItems(db.getProducts());
  }, []);

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
    toast.success("Produto excluído");
  };

  const openNew = () => {
    setDraft(empty);
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setDraft(p);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu catálogo</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
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

      {items.length === 0 ? (
        <EmptyState onAction={openNew} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id} className="rounded-2xl overflow-hidden">
              <div className="aspect-video bg-muted overflow-hidden">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Package className="h-8 w-8" />
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{p.name}</h3>
                  <span className="text-xs uppercase text-muted-foreground">{p.type}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="font-bold text-lg">{brl(p.price)}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
