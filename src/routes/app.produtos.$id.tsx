import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Lock, Upload, X, Loader2 } from "lucide-react";
import { uploadProductImage } from "@/lib/image-upload";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { ProductType } from "@/lib/types";
import { CheckoutBuilder } from "./app.checkouts.$id";

export const Route = createFileRoute("/app/produtos/$id")({
  component: ProductPage,
});

type Draft = {
  name: string;
  description: string;
  image: string;
  type: ProductType;
  delivery_url: string;
};

const empty: Draft = {
  name: "",
  description: "",
  image: "",
  type: "digital",
  delivery_url: "",
};

function ProductPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isNew = id === "new";

  const [draft, setDraft] = useState<Draft>(empty);
  const [tab, setTab] = useState<"produto" | "checkout">("produto");

  const productQ = useQuery({
    queryKey: ["product", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,description,image,type,delivery_url")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (productQ.data) {
      setDraft({
        name: productQ.data.name ?? "",
        description: productQ.data.description ?? "",
        image: productQ.data.image ?? "",
        type: (productQ.data.type as ProductType) ?? "digital",
        delivery_url: productQ.data.delivery_url ?? "",
      });
    }
  }, [productQ.data]);

  // Find or create checkout for this product
  const checkoutQ = useQuery({
    queryKey: ["checkout-for-product", id],
    enabled: !isNew && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkouts")
        .select("id")
        .eq("product_id", id)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.id ?? null;
    },
  });

  const ensureCheckoutM = useMutation({
    mutationFn: async (productName: string) => {
      if (!user) throw new Error("Não autenticado");
      const { data: existing } = await supabase
        .from("checkouts")
        .select("id")
        .eq("product_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (existing && existing.length > 0) return existing[0].id as string;
      const { data, error } = await supabase
        .from("checkouts")
        .insert({
          user_id: user.id,
          product_id: id,
          name: `Checkout — ${productName}`,
          amount: 0,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkout-for-product", id] }),
    onError: (e: Error) => toast.error(`Falha ao criar checkout: ${e.message}`),
  });

  // Auto-create checkout when product exists but has none yet — only once per mount
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (
      !isNew &&
      user &&
      checkoutQ.isSuccess &&
      checkoutQ.data === null &&
      !ensureCheckoutM.isPending &&
      !autoCreatedRef.current
    ) {
      autoCreatedRef.current = true;
      ensureCheckoutM.mutate(draft.name || "Produto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, user, checkoutQ.isSuccess, checkoutQ.data]);

  const saveProductM = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!draft.name.trim()) throw new Error("Nome é obrigatório");
      const payload = {
        user_id: user.id,
        name: draft.name,
        description: draft.description,
        image: draft.image || null,
        type: draft.type,
        delivery_url: draft.delivery_url || null,
      };
      let productId: string;
      if (isNew) {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        productId = data.id as string;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
        productId = id;
      }

      // Ensure checkout exists — fail loudly so the toast surfaces the cause
      const { data: existing, error: selErr } = await supabase
        .from("checkouts")
        .select("id")
        .eq("product_id", productId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (selErr) throw new Error(`Checkout lookup: ${selErr.message}`);
      if (!existing || existing.length === 0) {
        const { error: insErr } = await supabase.from("checkouts").insert({
          user_id: user.id,
          product_id: productId,
          name: `Checkout — ${draft.name || "Produto"}`,
          amount: 0,
        } as never);
        if (insErr) throw new Error(`Criar checkout: ${insErr.message}`);
      }
      return productId;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", newId] });
      qc.invalidateQueries({ queryKey: ["checkout-for-product", newId] });
      toast.success(isNew ? "Produto criado" : "Produto atualizado");
      if (isNew && newId !== id) {
        nav({ to: "/app/produtos/$id", params: { id: newId }, replace: true });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleTabChange = async (v: string) => {
    if (v === "checkout") {
      if (isNew) {
        toast.error("Salve o produto primeiro");
        return;
      }
      if (!checkoutQ.data && !ensureCheckoutM.isPending) {
        await ensureCheckoutM.mutateAsync(draft.name || "Produto");
      }
    }
    setTab(v as "produto" | "checkout");
  };

  const checkoutId = checkoutQ.data ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/app/produtos"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-lg font-semibold truncate">
          {isNew ? "Novo produto" : draft.name || "Produto"}
        </h1>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="produto">Produto</TabsTrigger>
          <TabsTrigger value="checkout" disabled={isNew}>
            {isNew && <Lock className="h-3 w-3 mr-1" />}
            Checkout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produto" className="mt-4">
          <Card className="rounded-2xl max-w-2xl">
            <CardContent className="p-5 space-y-4">
              <Field label="Nome">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Descrição curta">
                <Textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>
              <Field label="Tipo">
                <Select
                  value={draft.type}
                  onValueChange={(v) => setDraft({ ...draft, type: v as ProductType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="fisico">Físico</SelectItem>
                    <SelectItem value="assinatura">Assinatura</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <p className="text-xs text-muted-foreground">
                O preço é definido na aba Checkout, permitindo variações de valor.
              </p>
              <Field label="URL da imagem">
                <Input
                  value={draft.image}
                  onChange={(e) => setDraft({ ...draft, image: e.target.value })}
                />
              </Field>
              <Field label="URL de entrega">
                <Input
                  value={draft.delivery_url}
                  onChange={(e) => setDraft({ ...draft, delivery_url: e.target.value })}
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={() => saveProductM.mutate()}
                  disabled={saveProductM.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saveProductM.isPending
                    ? "Salvando..."
                    : isNew
                    ? "Salvar e continuar"
                    : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checkout" className="mt-4">
          {checkoutQ.isLoading || ensureCheckoutM.isPending ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              Preparando checkout...
            </div>
          ) : checkoutId ? (
            <CheckoutBuilder id={checkoutId} />
          ) : (
            <div className="text-sm text-muted-foreground py-10 text-center">
              Não foi possível carregar o checkout.
            </div>
          )}
        </TabsContent>
      </Tabs>
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
