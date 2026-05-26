import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getCurrentVapidPublicKey, sendTestPushToUser } from "./push.server";

const SubscribeSchema = z.object({
  orderId: z.string().uuid(),
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  userAgent: z.string().max(500).optional(),
});

export const subscribePush = createServerFn({ method: "POST" })
  .inputValidator((d) => SubscribeSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status, created_at")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");

    // Ownership proxy: since buyers are anonymous, restrict push subscription
    // to pending orders within their active payment window (1 hour). This
    // limits the risk of an attacker who captures an orderId subscribing to
    // a stranger's payment notifications outside the buyer's checkout flow.
    const createdAt = new Date(order.created_at).getTime();
    const ageMs = Date.now() - createdAt;
    const ONE_HOUR = 60 * 60 * 1000;
    if (order.status !== "pendente" || ageMs > ONE_HOUR) {
      throw new Error("Inscrição de notificações indisponível para este pedido");
    }

    const { error: upErr } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          order_id: order.id,
          user_id: order.user_id,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
        },
        { onConflict: "endpoint" },
      );
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

// Admin (seller) subscription — not tied to a specific order
const AdminSubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  userAgent: z.string().max(500).optional(),
});

export const subscribeAdminPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AdminSubscribeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error: upErr } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          order_id: null,
          user_id: userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
        },
        { onConflict: "endpoint" },
      );
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return sendTestPushToUser(context.userId);
  });

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => ({
  publicKey: getCurrentVapidPublicKey(),
}));

