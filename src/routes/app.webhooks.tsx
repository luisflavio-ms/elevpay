import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, Webhook } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, seedIfNeeded, uid } from "@/lib/store";
import type { WebhookLog, WebhookEvent } from "@/lib/types";

export const Route = createFileRoute("/app/webhooks")({
  component: WebhooksPage,
});

const EVENTS: WebhookEvent[] = [
  "payment.approved",
  "payment.pending",
  "payment.refused",
  "payment.refunded",
  "checkout.created",
];

function WebhooksPage() {
  const [items, setItems] = useState<WebhookLog[]>([]);

  useEffect(() => {
    seedIfNeeded();
    setItems(db.getWebhooks());
  }, []);

  const sendTest = (event: WebhookEvent) => {
    const log: WebhookLog = {
      id: uid("w"),
      event,
      date: new Date().toISOString(),
      payload: { test: true, event, ts: Date.now() },
    };
    const next = [log, ...items];
    setItems(next);
    db.setWebhooks(next);
    toast.success("Webhook de teste enviado");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="text-sm text-muted-foreground">Logs e eventos da sua conta</p>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">Enviar evento de teste</h3>
          <div className="flex flex-wrap gap-2">
            {EVENTS.map((e) => (
              <Button key={e} size="sm" variant="outline" onClick={() => sendTest(e)}>
                <Send className="h-3 w-3 mr-1" /> {e}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center">
            <Webhook className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum evento ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((log) => (
            <Card key={log.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary">{log.event}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.date).toLocaleString("pt-BR")}
                  </span>
                </div>
                <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto">
{JSON.stringify(log.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
