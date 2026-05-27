import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { testWebhookConfig, type WebhookEvent } from "./webhooks.server";

const EVENTS = [
  "payment.approved",
  "payment.pending",
  "payment.refused",
  "payment.refunded",
  "checkout.created",
] as const;

const testInput = z.object({
  configId: z.string().uuid(),
  event: z.enum(EVENTS),
});

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => testInput.parse(input))
  .handler(async ({ data, context }) => {
    return testWebhookConfig(
      context.userId,
      data.configId,
      data.event as WebhookEvent,
    );
  });
