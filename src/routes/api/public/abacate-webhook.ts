import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Webhook do AbacatePay.
 * Configurar URL: https://<seu-dominio>/api/public/abacate-webhook?webhookSecret=<ABACATE_WEBHOOK_SECRET>
 * Eventos: billing.paid, billing.expired, billing.cancelled, billing.refunded
 */
export const Route = createFileRoute("/api/public/abacate-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ABACATE_WEBHOOK_SECRET;
        if (!expected) {
          return new Response("Webhook secret not configured", { status: 500 });
        }

        const url = new URL(request.url);
        const provided = url.searchParams.get("webhookSecret");
        if (provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { event?: string; data?: { id?: string; status?: string } };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const billingId = body?.data?.id;
        const event = body?.event ?? "";
        if (!billingId) return new Response("Missing billing id", { status: 400 });

        // Mapeia evento → status interno
        const statusMap: Record<string, "aprovado" | "recusado" | "reembolsado" | "pendente"> = {
          "billing.paid": "aprovado",
          "billing.expired": "recusado",
          "billing.cancelled": "recusado",
          "billing.refunded": "reembolsado",
        };
        const newStatus = statusMap[event];
        if (!newStatus) {
          // Evento desconhecido: ignorar, mas responder 200 para não retry
          return new Response("ok", { status: 200 });
        }

        const { data: order, error: findErr } = await supabaseAdmin
          .from("orders")
          .select("id, user_id, product_id, amount, status")
          .eq("abacate_billing_id", billingId)
          .maybeSingle();

        if (findErr) {
          console.error("[abacate-webhook] find error", findErr);
          return new Response("DB error", { status: 500 });
        }
        if (!order) return new Response("Order not found", { status: 404 });

        // Idempotência: se já aprovado, não duplica venda
        if (order.status === newStatus) return new Response("ok", { status: 200 });

        const { error: updateErr } = await supabaseAdmin
          .from("orders")
          .update({ status: newStatus })
          .eq("id", order.id);
        if (updateErr) {
          console.error("[abacate-webhook] update error", updateErr);
          return new Response("DB error", { status: 500 });
        }

        // Cria registro em sales quando aprovado
        if (newStatus === "aprovado") {
          const gross = Number(order.amount);
          const fee = Math.round(gross * 0.0499 * 100) / 100; // 4.99% taxa exemplo
          const net = Math.round((gross - fee) * 100) / 100;
          await supabaseAdmin.from("sales").insert({
            user_id: order.user_id,
            order_id: order.id,
            product_id: order.product_id,
            gross_amount: gross,
            fee_amount: fee,
            net_amount: net,
          });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
