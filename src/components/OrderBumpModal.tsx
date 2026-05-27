import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const orderBumpSchema = z
  .object({
    productId: z.string().uuid("Selecione um produto"),
    description: z.string().trim().max(500).default(""),
    price: z.number().positive("Preço deve ser maior que zero").max(100000),
    compareAtPrice: z
      .number()
      .positive()
      .max(100000)
      .nullable()
      .optional(),
  })
  .refine(
    (d) => d.compareAtPrice == null || d.compareAtPrice > d.price,
    {
      message: "Preço de comparação deve ser maior que o preço",
      path: ["compareAtPrice"],
    },
  );

export type OrderBumpInput = {
  id?: string;
  productId?: string;
  description: string;
  price: number;
  compareAtPrice?: number | null;
};

export function OrderBumpModal({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: OrderBumpInput | null;
  onSaved?: (id: string) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [productId, setProductId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [compareAtPrice, setCompareAtPrice] = useState<number | "">("");

  const productsQ = useQuery({
    queryKey: ["products", "for-bump"],
    enabled: open && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
      }));
    },
  });

  useEffect(() => {
    if (open) {
      setProductId(initial?.productId ?? "");
      setDescription(initial?.description ?? "");
      setPrice(initial?.price ?? 0);
      setCompareAtPrice(
        initial?.compareAtPrice != null ? Number(initial.compareAtPrice) : "",
      );
    }
  }, [open, initial]);

  const saveM = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const compareNum =
        compareAtPrice === "" || compareAtPrice == null
          ? null
          : Number(compareAtPrice);
      const parsed = orderBumpSchema.safeParse({
        productId,
        description,
        price,
        compareAtPrice: compareNum,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      }

      // Título derivado do nome do produto (mantém retrocompatibilidade)
      const product = productsQ.data?.find((p) => p.id === parsed.data.productId);
      if (!product) throw new Error("Produto inválido");

      const payload = {
        user_id: user.id,
        product_id: parsed.data.productId,
        title: product.name,
        description: parsed.data.description,
        price: parsed.data.price,
        compare_at_price: parsed.data.compareAtPrice ?? null,
      };
      if (initial?.id) {
        const { data, error } = await supabase
          .from("order_bumps")
          .update(payload)
          .eq("id", initial.id)
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }
      const { data, error } = await supabase
        .from("order_bumps")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["order_bumps"] });
      qc.invalidateQueries({ queryKey: ["order_bumps", "list"] });
      toast.success(initial?.id ? "Order bump atualizado" : "Order bump criado");
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const products = productsQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Editar order bump" : "Novo order bump"}
          </DialogTitle>
          <DialogDescription>
            Vincule um produto existente — a entrega é feita automaticamente após
            o pagamento. O preço é validado no servidor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    products.length
                      ? "Selecione um produto"
                      : "Nenhum produto cadastrado"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {products.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Crie um produto primeiro em "Produtos".
              </p>
            )}
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Texto curto que aparece no checkout"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preço do bump (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100000"
                value={price || ""}
                onChange={(e) => setPrice(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Preço "de" (riscado)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100000"
                value={compareAtPrice === "" ? "" : compareAtPrice}
                onChange={(e) =>
                  setCompareAtPrice(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
