import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyOrderStatus, notifySellerNewSale } from "@/lib/push.server";


/**
 * Webhook do AbacatePay.
 * Configurar URL: https://<seu-dominio>/api/public/abacate-webhook?webhookSecret=<ABACATE_WEBHOOK_SECRET>
 *
 * Eventos reais do AbacatePay:
 *  - checkout.completed     → pagamento concluído via Checkout Link
 *  - transparent.completed  → pagamento concluído via API (PIX QR Code transparente)
 *  - payout.completed       → saque concluído (não relacionado a vendas, ignorado)
 *  - billing.expired / billing.cancelled / billing.refunded → suportados se existirem
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

        let body: {
          event?: string;
          apiVersion?: number;
          data?: {
            id?: string;
            status?: string;
            billing?: { id?: string };
            pixQrCode?: { id?: string };
            transparent?: { id?: string };
          };
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = body?.event ?? "";
        // O id pode vir em data.id, data.billing.id ou data.pixQrCode.id dependendo do evento
        const billingId =
          body?.data?.id ??
          body?.data?.billing?.id ??
          body?.data?.pixQrCode?.id ??
          body?.data?.transparent?.id;

        // Mapeia evento → status interno
        const statusMap: Record<string, "aprovado" | "recusado" | "reembolsado" | "pendente"> = {
          "checkout.completed": "aprovado",
          "transparent.completed": "aprovado",
          "billing.paid": "aprovado",
          "billing.expired": "recusado",
          "billing.cancelled": "recusado",
          "billing.refunded": "reembolsado",
        };
        const newStatus = statusMap[event];
        if (!newStatus) {
          // payout.completed e outros: ignora mas responde 200 para evitar retry
          console.log("[abacate-webhook] ignored event", event);
          return new Response("ok", { status: 200 });
        }

        if (!billingId) return new Response("Missing billing id", { status: 400 });

        const { data: order, error: findErr } = await supabaseAdmin
          .from("orders")
          .select("id, user_id, product_id, amount, status, customer_name")
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
          // Notifica o vendedor (admin) da nova venda
          await notifySellerNewSale(order.user_id, gross, order.customer_name);
        }

        // Notifica cliente via push (se inscrito)
        await notifyOrderStatus(order.id, newStatus);

        return new Response("ok", { status: 200 });

      },
    },
  },
});
