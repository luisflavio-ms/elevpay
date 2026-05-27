import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const orderBumpSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório").max(120),
  description: z.string().trim().max(500).default(""),
  price: z.number().positive("Preço deve ser maior que zero").max(100000),
});

export type OrderBumpInput = {
  id?: string;
  title: string;
  description: string;
  price: number;
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setPrice(initial?.price ?? 0);
    }
  }, [open, initial]);

  const saveM = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const parsed = orderBumpSchema.safeParse({ title, description, price });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      }
      const payload = {
        user_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        price: parsed.data.price,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar order bump" : "Novo order bump"}</DialogTitle>
          <DialogDescription>
            Oferta adicional exibida no checkout. O preço é validado no servidor — o cliente
            não consegue alterar o valor cobrado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Bônus exclusivo"
            />
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
          <div>
            <Label>Preço (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="100000"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
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
