import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    // Resolve order to find owner user_id (so RLS can scope reads later)
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");

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
