import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Copy, ExternalLink, Pencil, Files, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl, db, seedIfNeeded, slugify, uid } from "@/lib/store";
import type { Checkout } from "@/lib/types";

export const Route = createFileRoute("/app/checkouts/")({
  component: ChecksList,
});

function ChecksList() {
  const [items, setItems] = useState<Checkout[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    seedIfNeeded();
    setItems(db.getCheckouts());
  }, []);

  const persist = (next: Checkout[]) => {
    setItems(next);
    db.setCheckouts(next);
  };

  const createNew = () => {
    const products = db.getProducts();
    const product = products[0];
    if (!product) {
      toast.error("Crie um produto antes");
      return;
    }
    const id = uid("c");
    const c: Checkout = {
      id,
      slug: slugify(`novo-checkout-${id.slice(-4)}`),
      name: "Novo checkout",
      productId: product.id,
      headline: product.name,
      subheadline: "",
      image: product.image,
      benefits: ["Acesso imediato", "Suporte dedicado"],
      testimonials: [],
      guarantee: "7 dias de garantia",
      primaryColor: "#16a34a",
      buttonText: "Comprar agora",
      paymentMethods: { pix: true, card: true, boleto: true },
      pixelMeta: "",
      pixelGoogle: "",
      webhookUrl: "",
      redirectUrl: "",
      scarcityTimerMinutes: 0,
      secureSeal: true,
      urgencyMessage: "",
      active: false,
      conversion: 0,
      revenue: 0,
    };
    persist([...items, c]);
    nav({ to: "/app/checkouts/$id", params: { id } });
  };

  const duplicate = (c: Checkout) => {
    const id = uid("c");
    const dup: Checkout = { ...c, id, slug: `${c.slug}-copia`, name: `${c.name} (cópia)`, revenue: 0, conversion: 0, active: false };
    persist([...items, dup]);
    toast.success("Checkout duplicado");
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/checkout/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Checkouts</h1>
          <p className="text-sm text-muted-foreground">Suas páginas de venda</p>
        </div>
        <Button onClick={createNew}>
          <Plus className="h-4 w-4 mr-2" /> Criar checkout
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">Nenhum checkout ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Crie seu primeiro checkout otimizado.</p>
            <Button onClick={createNew}><Plus className="h-4 w-4 mr-2" />Criar checkout</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((c) => (
            <Card key={c.id} className="rounded-2xl">
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{c.name}</h3>
                    <Badge variant={c.active ? "default" : "secondary"}>
                      {c.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">/checkout/{c.slug}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-muted-foreground">Conv.: <b className="text-foreground">{c.conversion}%</b></span>
                    <span className="text-muted-foreground">Receita: <b className="text-foreground">{brl(c.revenue)}</b></span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button size="sm" variant="outline" onClick={() => copyLink(c.slug)}>
                    <Copy className="h-4 w-4 mr-1" /> Link
                  </Button>
                  <Link to="/checkout/$slug" params={{ slug: c.slug }} target="_blank">
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => duplicate(c)}>
                    <Files className="h-4 w-4 mr-1" /> Duplicar
                  </Button>
                  <Link to="/app/checkouts/$id" params={{ id: c.id }}>
                    <Button size="sm">
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
