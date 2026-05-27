import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyOrderStatus, notifySellerNewSale, notifySellerPendingSale } from "./push.server";
import { dispatchUserWebhooks } from "./webhooks.server";
import { sendTransactionalEmailServer } from "./email/send.server";


const ABACATE_BASE = "https://api.abacatepay.com/v2";

const createPixInput = z.object({
  publicId: z.string().min(10).max(10).regex(/^[a-z0-9]+$/),
  customer: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(200),
    cpf: z.string().min(11).max(20),
    phone: z.string().min(8).max(30),
  }),
  bumpOn: z.boolean().optional().default(false),
  utm: z
    .object({
      source: z.string().max(120).optional(),
      medium: z.string().max(120).optional(),
      campaign: z.string().max(120).optional(),
      term: z.string().max(120).optional(),
      content: z.string().max(120).optional(),
    })
    .optional(),
});

type AbacateBilling = {
  id: string;
  amount: number;
  status: string;
  expiresAt: string;
  brCode: string;
  brCodeBase64: string;
};

/**
 * Cria um pagamento PIX via AbacatePay e registra um pedido pendente.
 * Chamado publicamente (anon) da página /checkout/:publicId.
 * O public_id pode ser o do próprio checkout OU de uma variação de preço.
 */
export const createPixPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => createPixInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ABACATE_API_KEY;
    if (!apiKey) throw new Error("ABACATE_API_KEY não configurada");

    // 1) Tenta achar uma variação de preço com esse public_id
    const { data: variant } = await supabaseAdmin
      .from("checkout_price_variants")
      .select("checkout_id, amount")
      .eq("public_id", data.publicId)
      .maybeSingle();

    // 2) Busca o checkout (por id se veio de variante, senão por public_id)
    const checkoutQ = variant
      ? supabaseAdmin
          .from("checkouts")
          .select("id, user_id, product_id, order_bump_id, redirect_url, active, amount")
          .eq("id", variant.checkout_id)
      : supabaseAdmin
          .from("checkouts")
          .select("id, user_id, product_id, order_bump_id, redirect_url, active, amount")
          .eq("public_id", data.publicId);

    const { data: ckRow, error: ckErr } = await checkoutQ.maybeSingle();

    if (ckErr) throw new Error(ckErr.message);
    if (!ckRow || !ckRow.active) throw new Error("Checkout indisponível");

    const [{ data: pRow }, { data: bRow }] = await Promise.all([
      ckRow.product_id
        ? supabaseAdmin
            .from("products")
            .select("id, name")
            .eq("id", ckRow.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ckRow.order_bump_id
        ? supabaseAdmin
            .from("order_bumps")
            .select("id, title, price")
            .eq("id", ckRow.order_bump_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const basePrice = variant
      ? Number(variant.amount)
      : Number(ckRow.amount ?? 0);
    const bumpPrice = data.bumpOn && bRow ? Number(bRow.price) : 0;
    const total = basePrice + bumpPrice;

    if (total <= 0) throw new Error("Valor inválido");

    const amountCents = Math.round(total * 100);
    const cellphone = data.customer.phone.replace(/\D/g, "");
    const taxId = data.customer.cpf.replace(/\D/g, "");

    if (taxId.length !== 11 && taxId.length !== 14) {
      throw new Error("CPF/CNPJ inválido. Informe 11 dígitos (CPF) ou 14 (CNPJ).");
    }
    if (cellphone.length < 10 || cellphone.length > 11) {
      throw new Error("Telefone inválido. Informe DDD + número.");
    }

    // Anti-flood: rejeita se já existe pedido pendente recente p/ mesmo checkout+CPF
    const since = new Date(Date.now() - 30_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("checkout_id", ckRow.id)
      .eq("customer_document", taxId)
      .eq("status", "pendente")
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    if (recent) {
      throw new Error("Já existe um PIX pendente para este checkout. Aguarde alguns segundos.");
    }




    const res = await fetch(`${ABACATE_BASE}/transparents/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "PIX",
        data: {
          amount: amountCents,
          expiresIn: 3600,
          description: pRow?.name ?? "Pagamento",
          customer: {
            name: data.customer.name,
            cellphone,
            email: data.customer.email,
            taxId,
          },
        },
      }),
    });

    const json = (await res.json()) as { data?: AbacateBilling; error?: string };
    if (!res.ok || !json.data) {
      throw new Error(`AbacatePay [${res.status}]: ${json.error ?? "erro"}`);
    }

    const billing = json.data;

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: ckRow.user_id,
        checkout_id: ckRow.id,
        product_id: ckRow.product_id,
        customer_name: data.customer.name,
        customer_email: data.customer.email,
        customer_document: taxId,
        customer_phone: cellphone,
        amount: total,
        status: "pendente",
        method: "pix",
        abacate_billing_id: billing.id,
        pix_qr_code: billing.brCodeBase64,
        pix_copy_paste: billing.brCode,
        pix_expires_at: billing.expiresAt,
        utm_source: data.utm?.source ?? null,
        utm_medium: data.utm?.medium ?? null,
        utm_campaign: data.utm?.campaign ?? null,
        utm_term: data.utm?.term ?? null,
        utm_content: data.utm?.content ?? null,
        metadata: { bump: data.bumpOn ?? false },
      })
      .select("id")
      .single();

    if (orderErr) throw new Error(orderErr.message);

    // Dispara push pra o vendedor avisando da venda pendente (não bloqueia).
    notifySellerPendingSale(ckRow.user_id, total, data.customer.name).catch(
      (e) => console.error("[push] pending notify failed", e),
    );

    // Dispara webhooks payment.pending configurados pelo vendedor (Utmify, Zapier, etc.)
    try {
      await dispatchUserWebhooks(ckRow.user_id, "payment.pending", {
        id: order.id,
        amount: total,
        customer_name: data.customer.name,
        customer_email: data.customer.email,
        customer_document: taxId,
        customer_phone: cellphone,
        product_id: ckRow.product_id,
        utm_source: data.utm?.source ?? null,
        utm_medium: data.utm?.medium ?? null,
        utm_campaign: data.utm?.campaign ?? null,
        utm_term: data.utm?.term ?? null,
        utm_content: data.utm?.content ?? null,
      });
    } catch (e) {
      console.error("[webhooks] pending dispatch failed", e);
    }

    return {
      orderId: order.id,
      billingId: billing.id,
      qrCodeBase64: billing.brCodeBase64,
      copyPaste: billing.brCode,
      expiresAt: billing.expiresAt,
      amount: total,
      redirectUrl: ckRow.redirect_url ?? null,
    };
  });

const checkStatusInput = z.object({ orderId: z.string().uuid() });

/**
 * Consulta o status atual do pedido (polling do checkout).
 * Se ainda estiver pendente, consulta a AbacatePay diretamente e sincroniza
 * — útil quando o webhook não foi entregue (ambiente dev, URL/secret errado, etc.).
 */
export const checkOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => checkStatusInput.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, product_id, amount, status, abacate_billing_id, customer_name, customer_email")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return { status: "pendente" as const };

    if (order.status !== "pendente" || !order.abacate_billing_id) {
      return { status: order.status };
    }

    const apiKey = process.env.ABACATE_API_KEY;
    if (!apiKey) return { status: order.status };

    // Consulta AbacatePay diretamente
    try {
      const res = await fetch(
        `https://api.abacatepay.com/v2/transparents/check?id=${encodeURIComponent(order.abacate_billing_id)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      const json = (await res.json().catch(() => ({}))) as {
        data?: { status?: string };
      };
      const remoteStatus = json.data?.status?.toUpperCase();
      // AbacatePay retorna PAID quando pago, EXPIRED, CANCELLED, REFUNDED, PENDING
      const map: Record<string, "aprovado" | "recusado" | "reembolsado"> = {
        PAID: "aprovado",
        EXPIRED: "recusado",
        CANCELLED: "recusado",
        REFUNDED: "reembolsado",
      };
      const newStatus = remoteStatus ? map[remoteStatus] : undefined;
      if (newStatus) {
        await supabaseAdmin.from("orders").update({ status: newStatus }).eq("id", order.id);
        if (newStatus === "aprovado") {
          const gross = Number(order.amount);
          const fee = Math.round(gross * 0.0499 * 100) / 100;
          const net = Math.round((gross - fee) * 100) / 100;
          await supabaseAdmin.from("sales").insert({
            user_id: order.user_id,
            order_id: order.id,
            product_id: order.product_id,
            gross_amount: gross,
            fee_amount: fee,
            net_amount: net,
          });
          await notifySellerNewSale(order.user_id, gross, order.customer_name);

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
                console.warn("[checkOrderStatus] product without delivery_url, skipping access email", {
                  productId: order.product_id,
                });
              }
            } catch (err) {
              console.error("[checkOrderStatus] access email failed", err);
            }
          }
        }
        await notifyOrderStatus(order.id, newStatus);
        const eventMap = {
          aprovado: "payment.approved",
          recusado: "payment.refused",
          reembolsado: "payment.refunded",
        } as const;
        try {
          await dispatchUserWebhooks(order.user_id, eventMap[newStatus], {
            id: order.id,
            amount: Number(order.amount),
            customer_name: order.customer_name,
            product_id: order.product_id,
          });
        } catch (e) {
          console.error("[webhooks] dispatch failed", e);
        }
        return { status: newStatus };
      }

    } catch (err) {
      console.error("[checkOrderStatus] abacate check failed", err);
    }

    return { status: order.status };
  });

