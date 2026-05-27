import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Send,
  Webhook,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { testWebhook } from "@/lib/webhooks.functions";

export const Route = createFileRoute("/app/webhooks")({
  component: WebhooksPage,
});

type WebhookEvent =
  | "payment.approved"
  | "payment.pending"
  | "payment.refused"
  | "payment.refunded"
  | "checkout.created";

type Provider = "utmify" | "custom" | "zapier" | "make";

type WebhookConfig = {
  id: string;
  user_id: string;
  provider: Provider;
  name: string;
  url: string;
  api_token: string | null;
  events: WebhookEvent[];
  active: boolean;
  created_at: string;
};

type WebhookLog = {
  id: string;
  webhook_config_id: string | null;
  event: WebhookEvent;
  status_code: number | null;
  success: boolean;
  payload: unknown;
  error: string | null;
  created_at: string;
};

const EVENTS: WebhookEvent[] = [
  "payment.approved",
  "payment.pending",
  "payment.refused",
  "payment.refunded",
  "checkout.created",
];

const emptyForm = (): Omit<WebhookConfig, "id" | "user_id" | "created_at"> => ({
  provider: "utmify",
  name: "",
  url: "",
  api_token: "",
  events: ["payment.approved", "payment.pending"],
  active: true,
});

function WebhooksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<WebhookConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const configsQ = useQuery({
    queryKey: ["webhook_configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_configs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WebhookConfig[];
    },
  });

  const logsQ = useQuery({
    queryKey: ["webhook_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as WebhookLog[];
    },
  });

  const saveM = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!form.name.trim() || !form.url.trim())
        throw new Error("Nome e URL são obrigatórios");
      const payload = {
        user_id: user.id,
        provider: form.provider,
        name: form.name.trim(),
        url: form.url.trim(),
        api_token: form.api_token || null,
        events: form.events,
        active: form.active,
      };
      if (editing) {
        const { error } = await supabase
          .from("webhook_configs")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("webhook_configs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook_configs"] });
      toast.success(editing ? "Webhook atualizado" : "Webhook criado");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhook_configs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook_configs"] });
      toast.success("Webhook removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleM = useMutation({
    mutationFn: async (c: WebhookConfig) => {
      const { error } = await supabase
        .from("webhook_configs")
        .update({ active: !c.active })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook_configs"] }),
  });

  const testFn = useServerFn(testWebhook);
  const testM = useMutation({
    mutationFn: async ({
      config,
      event,
    }: {
      config: WebhookConfig;
      event: WebhookEvent;
    }) => {
      return testFn({ data: { configId: config.id, event } });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["webhook_logs"] });
      if (result.success) toast.success(`Webhook enviado (HTTP ${result.statusCode})`);
      else toast.error(`Falha: ${result.errorMsg ?? "erro desconhecido"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const startEdit = (c: WebhookConfig) => {
    setEditing(c);
    setForm({
      provider: c.provider,
      name: c.name,
      url: c.url,
      api_token: c.api_token ?? "",
      events: c.events ?? [],
      active: c.active,
    });
    setOpen(true);
  };

  const toggleEvent = (ev: WebhookEvent) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev)
        ? f.events.filter((e) => e !== ev)
        : [...f.events, ev],
    }));
  };

  const configs = configsQ.data ?? [];
  const logs = logsQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Integre com Utmify, Zapier, Make ou seu próprio endpoint
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo webhook
        </Button>
      </div>

      {configsQ.isLoading ? (
        <Card className="rounded-2xl">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Carregando…
          </CardContent>
        </Card>
      ) : configs.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center">
            <Webhook className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">Nenhum webhook configurado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie um webhook para receber notificações de pedidos.
            </p>
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4 mr-2" /> Criar webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {configs.map((c) => (
            <Card key={c.id} className="rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{c.name}</h3>
                      <Badge variant="secondary" className="capitalize">
                        {c.provider}
                      </Badge>
                      {!c.active && <Badge variant="outline">Pausado</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-1 break-all">
                      {c.url}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={c.active}
                      onCheckedChange={() => toggleM.mutate(c)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => startEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Remover "${c.name}"?`)) deleteM.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {c.events.map((e) => (
                    <Badge key={e} variant="outline" className="text-xs">
                      {e}
                    </Badge>
                  ))}
                </div>

                <div className="border-t pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Enviar evento de teste
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {EVENTS.map((ev) => (
                      <Button
                        key={ev}
                        size="sm"
                        variant="outline"
                        disabled={testM.isPending}
                        onClick={() => testM.mutate({ config: c, event: ev })}
                      >
                        <Send className="h-3 w-3 mr-1" /> {ev}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Histórico</h2>
        {logs.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum disparo registrado ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <Card key={log.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {log.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-500" />
                      )}
                      <Badge variant="secondary">{log.event}</Badge>
                      {log.status_code != null && (
                        <Badge variant="outline">HTTP {log.status_code}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {log.error && (
                    <div className="text-xs text-rose-500 mb-2">{log.error}</div>
                  )}
                  <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto">
{JSON.stringify(log.payload, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar webhook" : "Novo webhook"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Provedor</Label>
              <Select
                value={form.provider}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, provider: v as Provider }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utmify">Utmify</SelectItem>
                  <SelectItem value="zapier">Zapier</SelectItem>
                  <SelectItem value="make">Make</SelectItem>
                  <SelectItem value="custom">Customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Integração Utmify"
              />
            </div>

            <div className="grid gap-2">
              <Label>URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://api.utmify.com.br/api-credentials/orders"
              />
            </div>

            <div className="grid gap-2">
              <Label>
                Token / API Key{" "}
                <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Input
                type="password"
                value={form.api_token ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, api_token: e.target.value }))
                }
                placeholder="Enviado como Authorization: Bearer …"
              />
            </div>

            <div className="grid gap-2">
              <Label>Eventos</Label>
              <div className="grid grid-cols-2 gap-2">
                {EVENTS.map((ev) => (
                  <label
                    key={ev}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={form.events.includes(ev)}
                      onCheckedChange={() => toggleEvent(ev)}
                    />
                    <span>{ev}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              {saveM.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
