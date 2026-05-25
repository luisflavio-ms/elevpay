import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ABACATE_BASE = "https://api.abacatepay.com/v2";

const createPixInput = z.object({
  slug: z.string().min(1).max(120),
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
 * Chamado publicamente (anon) da página /checkout/:slug.
 */
export const createPixPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => createPixInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ABACATE_API_KEY;
    if (!apiKey) throw new Error("ABACATE_API_KEY não configurada");

    // Busca checkout + produto + bump pelo slug
    const { data: ckRow, error: ckErr } = await supabaseAdmin
      .from("checkouts")
      .select("id, user_id, product_id, order_bump_id, redirect_url, active")
      .eq("slug", data.slug)
      .maybeSingle();

    if (ckErr) throw new Error(ckErr.message);
    if (!ckRow || !ckRow.active) throw new Error("Checkout indisponível");

    const [{ data: pRow }, { data: bRow }] = await Promise.all([
      ckRow.product_id
        ? supabaseAdmin
            .from("products")
            .select("id, name, price")
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

    const productPrice = Number(pRow?.price ?? 0);
    const bumpPrice = data.bumpOn && bRow ? Number(bRow.price) : 0;
    const total = productPrice + bumpPrice;

    if (total <= 0) throw new Error("Valor inválido");

    const amountCents = Math.round(total * 100);
    const cellphone = data.customer.phone.replace(/\D/g, "");
    const taxId = data.customer.cpf.replace(/\D/g, "");

    const res = await fetch(`${ABACATE_BASE}/pixQrCode/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountCents,
        expiresIn: 3600,
        description: pRow?.name ?? "Pagamento",
        customer: {
          name: data.customer.name,
          cellphone,
          email: data.customer.email,
          taxId,
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

/** Consulta o status atual do pedido (polling do checkout). */
export const checkOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => checkStatusInput.parse(input))
  .handler(async ({ data }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { status: order?.status ?? "pendente" };
  });
