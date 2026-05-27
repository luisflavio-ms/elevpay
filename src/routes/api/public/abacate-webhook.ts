import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyOrderStatus, notifySellerNewSale } from "@/lib/push.server";
import { sendTransactionalEmailServer } from "@/lib/email/send.server";
import { dispatchUserWebhooks } from "@/lib/webhooks.server";

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}


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

        // Aceita secret via header (preferido) ou querystring (fallback p/ compat)
        const url = new URL(request.url);
        const provided =
          request.headers.get("x-webhook-secret") ??
          url.searchParams.get("webhookSecret") ??
          "";
        if (!safeEq(provided, expected)) {
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
          .select("id, user_id, product_id, amount, status, customer_name, customer_email, customer_document, customer_phone, utm_source, utm_medium, utm_campaign, utm_term, utm_content")
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

          // Envia email de liberação de acesso ao cliente
          if (order.customer_email && order.product_id) {
            try {
              const { data: product } = await supabaseAdmin
                .from("products")
                .select("name, delivery_url")
                .eq("id", order.product_id)
                .maybeSingle();

              if (product?.delivery_url) {
                const amountFmt = new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(Number(order.amount));

                await sendTransactionalEmailServer({
                  templateName: "product-access",
                  recipientEmail: order.customer_email,
                  idempotencyKey: `product-access-${order.id}`,
                  templateData: {
                    customerName: order.customer_name?.split(" ")[0],
                    productName: product.name,
                    accessUrl: product.delivery_url,
                    orderId: order.id,
                    amount: amountFmt,
                  },
                });
              } else {
                console.warn(
                  "[abacate-webhook] product without delivery_url, skipping access email",
                  { productId: order.product_id }
                );
              }
            } catch (err) {
              console.error("[abacate-webhook] access email failed", err);
            }
          }
        }

        // Notifica cliente via push (se inscrito)
        await notifyOrderStatus(order.id, newStatus);

        // Dispara webhooks configurados pelo vendedor (Utmify, Zapier, Make, etc.)
        const eventMap = {
          aprovado: "payment.approved",
          recusado: "payment.refused",
          reembolsado: "payment.refunded",
          pendente: "payment.pending",
        } as const;
        try {
          await dispatchUserWebhooks(order.user_id, eventMap[newStatus], {
            id: order.id,
            amount: Number(order.amount),
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            customer_document: order.customer_document,
            customer_phone: order.customer_phone,
            product_id: order.product_id,
            utm_source: order.utm_source,
            utm_medium: order.utm_medium,
            utm_campaign: order.utm_campaign,
            utm_term: order.utm_term,
            utm_content: order.utm_content,
          });
        } catch (e) {
          console.error("[webhooks] dispatch failed", e);
        }

        return new Response("ok", { status: 200 });

      },
    },
  },
});
