import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VAPID_PUBLIC_KEY =
  "BBiX5A6AsFCSf4QxqZF0eyQc8jn86nLKHjpg2zo0GEiDDK8x9eMU2RTSnCjxxAAUzI71c0ddUj0SElrGItD9PZw";

function normalizeSubject(raw?: string) {
  const s = (raw || "").trim();
  if (!s) return "https://elevpay.lovable.app";
  if (s.startsWith("mailto:") || s.startsWith("https://") || s.startsWith("http://")) return s;
  return s.includes("@") ? `mailto:${s}` : `https://${s}`;
}

export const Route = createFileRoute("/api/public/test-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-test-secret");
        if (!secret || secret !== process.env.ABACATE_WEBHOOK_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { subscriptionId } = (await request.json()) as { subscriptionId?: string };
        if (!subscriptionId) {
          return Response.json({ ok: false, error: "missing subscriptionId" }, { status: 400 });
        }

        const { data: sub, error } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("id", subscriptionId)
          .maybeSingle();

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        if (!sub) return Response.json({ ok: false, error: "subscription not found" }, { status: 404 });

        const subject = normalizeSubject(process.env.VAPID_SUBJECT);
        const priv = process.env.VAPID_PRIVATE_KEY;
        if (!priv) return Response.json({ ok: false, error: "VAPID_PRIVATE_KEY missing" }, { status: 500 });
        webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, priv);

        const payload = JSON.stringify({
          title: "🔔 Teste ElevPay",
          body: "Notificação de teste — se você está vendo, está funcionando!",
          url: "/app/dashboard",
          tag: `test-${Date.now()}`,
        });

        try {
          const result = await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          return Response.json({
            ok: true,
            statusCode: result.statusCode,
            headers: result.headers,
            subject,
            endpointHost: new URL(sub.endpoint).host,
          });
        } catch (err) {
          const e = err as { statusCode?: number; body?: string; message?: string };
          return Response.json({
            ok: false,
            statusCode: e.statusCode,
            body: e.body,
            message: e.message,
            subject,
            endpointHost: new URL(sub.endpoint).host,
          }, { status: 200 });
        }
      },
    },
  },
});
