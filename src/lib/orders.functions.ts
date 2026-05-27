import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailServer } from "@/lib/email/send.server";

const InputSchema = z.object({ orderId: z.string().uuid() });

export const resendProductAccessEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, user_id, product_id, customer_name, customer_email, amount, status"
      )
      .eq("id", data.orderId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!order) throw new Error("Pedido não encontrado");
    if (order.user_id !== userId) throw new Error("Sem permissão");
    if (order.status !== "aprovado")
      throw new Error("Só é possível reenviar acesso de pedidos aprovados");
    if (!order.customer_email) throw new Error("Pedido sem email do cliente");
    if (!order.product_id) throw new Error("Pedido sem produto vinculado");

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("name, delivery_url")
      .eq("id", order.product_id)
      .maybeSingle();

    if (!product?.delivery_url)
      throw new Error("Produto sem URL de entrega configurada");

    const amountFmt = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(order.amount));

    const result = await sendTransactionalEmailServer({
      templateName: "product-access",
      recipientEmail: order.customer_email,
      // Unique key per resend so it doesn't dedupe with the original send
      idempotencyKey: `product-access-${order.id}-resend-${Date.now()}`,
      templateData: {
        customerName: order.customer_name?.split(" ")[0],
        productName: product.name,
        accessUrl: product.delivery_url,
        orderId: order.id,
        amount: amountFmt,
      },
    });

    if (!result.success) {
      throw new Error(
        result.reason === "email_suppressed"
          ? "Email do cliente está na lista de bloqueio"
          : "Falha ao enviar email"
      );
    }

    return { success: true };
  });
