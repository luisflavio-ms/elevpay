import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Copy, ExternalLink, Pencil, Files, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { rowToCheckout, type CheckoutRow } from "@/lib/checkout-mapper";
import type { Checkout } from "@/lib/types";
import { checkoutOrigin } from "@/lib/domains";

export const Route = createFileRoute("/app/checkouts/")({
  component: ChecksList,
});

function ChecksList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();

  const q = useQuery({
    queryKey: ["checkouts"],
    queryFn: async (): Promise<Checkout[]> => {
      const { data, error } = await supabase
        .from("checkouts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => rowToCheckout(r as unknown as CheckoutRow));
    },
  });

  const items = q.data ?? [];

  const createM = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("id,name,image")
        .limit(1);
      if (pErr) throw pErr;
      const product = products?.[0];
      if (!product) throw new Error("Crie um produto antes");

      const { data, error } = await supabase
        .from("checkouts")
        .insert({
          user_id: user.id,
          product_id: product.id,
          name: "Novo checkout",
          headline: product.name,
          subheadline: "",
          image: product.image,
          benefits: ["Acesso imediato", "Suporte dedicado"],
          testimonials: [],
          guarantee: "7 dias de garantia",
          primary_color: "#16a34a",
          button_text: "Comprar agora",
          payment_methods: { pix: true, card: true, boleto: true },
          scarcity_timer_minutes: 0,
          secure_seal: true,
          urgency_message: "",
          active: false,
          blocks: [],
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["checkouts"] });
      nav({ to: "/app/checkouts/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateM = useMutation({
    mutationFn: async (c: Checkout) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("checkouts").insert({
        user_id: user.id,
        product_id: c.productId || null,
        order_bump_id: c.orderBumpId ?? null,
        slug: `${c.slug}-copia-${Math.random().toString(36).slice(2, 5)}`,
        name: `${c.name} (cópia)`,
        headline: c.headline,
        subheadline: c.subheadline,
        image: c.image || null,
        benefits: c.benefits,
        testimonials: c.testimonials as never,
        guarantee: c.guarantee,
        primary_color: c.primaryColor,
        button_text: c.buttonText,
        payment_methods: c.paymentMethods,
        pixel_meta: c.pixelMeta || null,
        pixel_google: c.pixelGoogle || null,
        webhook_url: c.webhookUrl || null,
        redirect_url: c.redirectUrl || null,
        scarcity_timer_minutes: c.scarcityTimerMinutes,
        secure_seal: c.secureSeal,
        urgency_message: c.urgencyMessage,
        active: false,
        blocks: (c.blocks ?? []) as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checkouts"] });
      toast.success("Checkout duplicado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${checkoutOrigin()}/checkout/${slug}`);
    toast.success("Link copiado");
  };

  if (q.isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }
  if (q.error) {
    return <div className="text-sm text-destructive">Erro: {(q.error as Error).message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Checkouts</h1>
          <p className="text-sm text-muted-foreground">Suas páginas de venda</p>
        </div>
        <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
          <Plus className="h-4 w-4 mr-2" /> Criar checkout
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">Nenhum checkout ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Crie seu primeiro checkout otimizado.</p>
            <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
              <Plus className="h-4 w-4 mr-2" />Criar checkout
            </Button>
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
                  <Button size="sm" variant="outline" onClick={() => duplicateM.mutate(c)} disabled={duplicateM.isPending}>
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
