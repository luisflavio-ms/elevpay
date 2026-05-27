import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type WebhookEvent =
  | "payment.approved"
  | "payment.pending"
  | "payment.refused"
  | "payment.refunded"
  | "checkout.created";

export type OrderForWebhook = {
  id: string;
  amount: number | string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_document?: string | null;
  customer_phone?: string | null;
  product_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
};

type WebhookConfigRow = {
  id: string;
  user_id: string;
  provider: string;
  url: string;
  api_token: string | null;
  events: WebhookEvent[];
  active: boolean;
  headers: Record<string, string> | null;
};

function buildGenericPayload(
  event: WebhookEvent,
  provider: string,
  order: OrderForWebhook,
) {
  const amountCents = Math.round(Number(order.amount) * 100);
  return {
    event,
    provider,
    timestamp: new Date().toISOString(),
    data: {
      order_id: order.id,
      amount: amountCents,
      amount_brl: Number(order.amount),
      product_id: order.product_id ?? null,
      customer: {
        name: order.customer_name ?? null,
        email: order.customer_email ?? null,
        document: order.customer_document ?? null,
        phone: order.customer_phone ?? null,
      },
      utm: {
        source: order.utm_source ?? null,
        medium: order.utm_medium ?? null,
        campaign: order.utm_campaign ?? null,
        term: order.utm_term ?? null,
        content: order.utm_content ?? null,
      },
    },
  };
}

function utmifyStatus(event: WebhookEvent): string {
  switch (event) {
    case "payment.approved":
      return "paid";
    case "payment.pending":
      return "waiting_payment";
    case "payment.refused":
      return "refused";
    case "payment.refunded":
      return "refunded";
    default:
      return "waiting_payment";
  }
}

// Formato Utmify: https://docs.utmify.com.br
function buildUtmifyPayload(
  event: WebhookEvent,
  order: OrderForWebhook,
  isTest = false,
) {
  const amountCents = Math.round(Number(order.amount) * 100);
  const nowIso = new Date().toISOString().replace("T", " ").slice(0, 19);
  const status = utmifyStatus(event);
  return {
    orderId: order.id,
    platform: "ElevPay",
    paymentMethod: "pix",
    status,
    createdAt: nowIso,
    approvedDate: status === "paid" ? nowIso : null,
    refundedAt: status === "refunded" ? nowIso : null,
    customer: {
      name: order.customer_name ?? "Cliente",
      email: order.customer_email ?? "sem-email@exemplo.com",
      phone: order.customer_phone ?? null,
      document: order.customer_document ?? null,
      country: "BR",
      ip: "0.0.0.0",
    },
    products: [
      {
        id: order.product_id ?? "produto",
        name: "Produto",
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: amountCents,
      },
    ],
    trackingParameters: {
      src: null,
      sck: null,
      utm_source: order.utm_source ?? null,
      utm_campaign: order.utm_campaign ?? null,
      utm_medium: order.utm_medium ?? null,
      utm_content: order.utm_content ?? null,
      utm_term: order.utm_term ?? null,
    },
    commission: {
      totalPriceInCents: amountCents,
      gatewayFeeInCents: 0,
      userCommissionInCents: amountCents,
    },
    isTest,
  };
}

function buildPayload(
  event: WebhookEvent,
  provider: string,
  order: OrderForWebhook,
  isTest = false,
) {
  if (provider === "utmify") return buildUtmifyPayload(event, order, isTest);
  return buildGenericPayload(event, provider, order);
}

async function fireOne(
  config: WebhookConfigRow,
  event: WebhookEvent,
  payload: unknown,
) {
  let statusCode: number | null = null;
  let success = false;
  let errorMsg: string | null = null;
  let responseBody: unknown = null;

  const authHeaders: Record<string, string> =
    config.provider === "utmify"
      ? config.api_token
        ? { "x-api-token": config.api_token }
        : {}
      : config.api_token
        ? { Authorization: `Bearer ${config.api_token}` }
        : {};

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...(config.headers ?? {}),
      },
      body: JSON.stringify(payload),
    });
    statusCode = res.status;
    success = res.ok;
    const text = await res.text().catch(() => "");
    try {
      responseBody = text ? JSON.parse(text) : null;
    } catch {
      responseBody = text.slice(0, 1000);
    }
    if (!res.ok)
      errorMsg = `HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}`;
  } catch (e) {
    errorMsg = (e as Error).message;
  }

  await supabaseAdmin.from("webhook_logs").insert({
    user_id: config.user_id,
    webhook_config_id: config.id,
    event,
    status_code: statusCode,
    success,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: payload as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: responseBody as any,
    error: errorMsg,
  });

  return { success, statusCode, errorMsg };
}

/**
 * Dispara o evento para todos os webhooks ativos do usuário que escutam o evento.
 * Roda em background (não bloqueia a resposta principal). Falhas são apenas logadas.
 */
export async function dispatchUserWebhooks(
  userId: string,
  event: WebhookEvent,
  order: OrderForWebhook,
): Promise<void> {
  const { data: configs, error } = await supabaseAdmin
    .from("webhook_configs")
    .select("id, user_id, provider, url, api_token, events, active, headers")
    .eq("user_id", userId)
    .eq("active", true)
    .contains("events", [event]);

  if (error) {
    console.error("[dispatchUserWebhooks] load configs error", error);
    return;
  }
  if (!configs || configs.length === 0) return;

  await Promise.all(
    (configs as WebhookConfigRow[]).map((c) =>
      fireOne(c, event, buildPayload(event, c.provider, order)).catch((e) =>
        console.error("[dispatchUserWebhooks] fire failed", c.id, e),
      ),
    ),
  );
}

/**
 * Testa um webhook específico (usado pela UI). Retorna o resultado do disparo.
 */
export async function testWebhookConfig(
  userId: string,
  configId: string,
  event: WebhookEvent,
) {
  const { data: config, error } = await supabaseAdmin
    .from("webhook_configs")
    .select("id, user_id, provider, url, api_token, events, active, headers")
    .eq("id", configId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!config) throw new Error("Webhook não encontrado");

  const payload = buildPayload(
    event,
    config.provider,
    {
      id: "test_" + Math.random().toString(36).slice(2, 10),
      amount: 97,
      customer_name: "Cliente Teste",
      customer_email: "teste@exemplo.com",
      customer_document: "00000000000",
      customer_phone: "11999999999",
      product_id: null,
    },
    true,
  );

  return fireOne(config as WebhookConfigRow, event, payload);
}
