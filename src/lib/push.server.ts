// Server-only helper. Never import from client/components.
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;

const VAPID_PUBLIC_KEY =
  "BBiX5A6AsFCSf4QxqZF0eyQc8jn86nLKHjpg2zo0GEiDDK8x9eMU2RTSnCjxxAAUzI71c0ddUj0SElrGItD9PZw";
const DEFAULT_VAPID_SUBJECT = "https://elevpay.lovable.app";

function normalizeVapidSubject(raw?: string) {
  const subject = (raw || "").trim();
  if (!subject) return DEFAULT_VAPID_SUBJECT;

  const asMailto = subject.startsWith("mailto:") ? subject : subject.includes("@") ? `mailto:${subject}` : null;
  if (asMailto && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asMailto)) return asMailto;

  const asUrl = subject.startsWith("http://") || subject.startsWith("https://") ? subject : `https://${subject}`;
  try {
    const url = new URL(asUrl);
    if (url.protocol === "https:" && url.hostname.includes(".")) return url.origin;
  } catch {
    // Falls back below.
  }

  console.warn("[push] invalid VAPID_SUBJECT, using default subject");
  return DEFAULT_VAPID_SUBJECT;
}

async function handlePushSendError(
  context: string,
  subscription: { id: string; endpoint: string },
  err: unknown,
) {
  const e = err as { statusCode?: number; body?: string; endpoint?: string };
  const body = e.body ?? "";
  const shouldDelete =
    e.statusCode === 404 ||
    e.statusCode === 410 ||
    (e.statusCode === 403 && subscription.endpoint.includes("web.push.apple.com") && body.includes("BadJwtToken"));

  if (shouldDelete) {
    await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
    console.warn(`[push] removed invalid subscription (${context})`, {
      statusCode: e.statusCode,
      body,
      endpoint: subscription.endpoint.slice(0, 80),
    });
    return;
  }

  console.error(`[push] send error (${context})`, {
    statusCode: e.statusCode,
    body,
    endpoint: subscription.endpoint.slice(0, 80),
  });
}

function ensureConfigured() {
  if (configured) return;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = normalizeVapidSubject(process.env.VAPID_SUBJECT);
  if (!priv) throw new Error("VAPID_PRIVATE_KEY not configured");
  webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, priv);
  configured = true;
}

export async function notifyOrderStatus(
  orderId: string,
  status: "aprovado" | "recusado" | "reembolsado" | "pendente",
) {
  try {
    ensureConfigured();
  } catch (e) {
    console.error("[push] config error", e);
    return;
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("order_id", orderId);

  if (!subs || subs.length === 0) return;

  const titleMap: Record<string, string> = {
    aprovado: "✅ Pagamento confirmado!",
    recusado: "❌ Pagamento não concluído",
    reembolsado: "↩️ Pedido reembolsado",
    pendente: "⏳ Pedido atualizado",
  };
  const bodyMap: Record<string, string> = {
    aprovado: "Recebemos seu pagamento. Acesse seu produto.",
    recusado: "Sua cobrança expirou ou foi cancelada.",
    reembolsado: "O valor do seu pedido foi reembolsado.",
    pendente: "Acompanhe o status do seu pedido.",
  };
  const payload = JSON.stringify({
    title: titleMap[status] ?? "ElevPay",
    body: bodyMap[status] ?? "",
    url: `/pedido/${orderId}`,
    tag: `order-${orderId}`,
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (err) {
        await handlePushSendError("order", s, err);
      }
    }),
  );
}

export async function notifySellerNewSale(
  sellerUserId: string,
  amount: number,
  customerName?: string | null,
) {
  try {
    ensureConfigured();
  } catch (e) {
    console.error("[push] config error", e);
    return;
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", sellerUserId)
    .is("order_id", null);

  if (!subs || subs.length === 0) return;

  const brl = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount || 0);
  const payload = JSON.stringify({
    title: "💰 Nova venda aprovada!",
    body: `${brl}${customerName ? ` — ${customerName}` : ""}`,
    url: `/app/dashboard`,
    tag: `sale-${Date.now()}`,
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (err) {
        await handlePushSendError("seller", s, err);
      }
    }),
  );
}

export async function notifySellerPendingSale(
  sellerUserId: string,
  amount: number,
  customerName?: string | null,
) {
  try {
    ensureConfigured();
  } catch (e) {
    console.error("[push] config error", e);
    return;
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", sellerUserId)
    .is("order_id", null);

  if (!subs || subs.length === 0) return;

  const brl = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount || 0);
  const payload = JSON.stringify({
    title: "⏳ Nova venda pendente",
    body: `${brl}${customerName ? ` — ${customerName}` : ""} aguardando pagamento`,
    url: `/app/dashboard`,
    tag: `pending-${Date.now()}`,
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (err) {
        await handlePushSendError("pending", s, err);
      }
    }),
  );
}

export async function sendTestPushToUser(userId: string) {
  try {
    ensureConfigured();
  } catch (e) {
    return { ok: false, error: (e as Error).message, sent: 0, results: [] };
  }

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message, sent: 0, results: [] };
  if (!subs || subs.length === 0) {
    return { ok: false, error: "Nenhuma assinatura encontrada para esse usuário", sent: 0, results: [] };
  }

  const payload = JSON.stringify({
    title: "🔔 Teste ElevPay",
    body: "Notificação de teste — se você está vendo, está tudo certo!",
    url: "/app/dashboard",
    tag: `test-${Date.now()}`,
  });

  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        const r = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        return { id: s.id, ok: true, statusCode: r.statusCode, host: new URL(s.endpoint).host };
      } catch (err) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        await handlePushSendError("test", s, err);
        return {
          id: s.id,
          ok: false,
          statusCode: e.statusCode,
          body: e.body,
          message: e.message,
          host: new URL(s.endpoint).host,
        };
      }
    }),
  );

  const sent = results.filter((r) => r.ok).length;
  return { ok: sent > 0, sent, total: subs.length, results };
}



