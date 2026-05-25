// Server-only helper. Never import from client/components.
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const pub = "BBiX5A6AsFCSf4QxqZF0eyQc8jn86nLKHjpg2zo0GEiDDK8x9eMU2RTSnCjxxAAUzI71c0ddUj0SElrGItD9PZw";
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@elevpay.app";
  if (!priv) throw new Error("VAPID_PRIVATE_KEY not configured");
  webpush.setVapidDetails(subject, pub, priv);
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
        const e = err as { statusCode?: number; body?: string; headers?: unknown; endpoint?: string };
        if (e.statusCode === 404 || e.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[push] send error", {
            statusCode: e.statusCode,
            body: e.body,
            endpoint: s.endpoint.slice(0, 80),
          });
        }
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
        const e = err as { statusCode?: number; body?: string; endpoint?: string };
        if (e.statusCode === 404 || e.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[push] send error (seller)", {
            statusCode: e.statusCode,
            body: e.body,
            endpoint: s.endpoint.slice(0, 80),
          });
        }
      }
    }),
  );
}

