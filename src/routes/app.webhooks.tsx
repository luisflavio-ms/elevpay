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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  product_ids: string[];
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

type ProductOption = { id: string; name: string };

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
  product_ids: [],
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

  const productsQ = useQuery({
    queryKey: ["products_options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductOption[];
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
      if (form.product_ids.length === 0)
        throw new Error("Selecione ao menos 1 produto para este webhook");
      const payload = {
        user_id: user.id,
        provider: form.provider,
        name: form.name.trim(),
        url: form.url.trim(),
        api_token: form.api_token || null,
        events: form.events,
        active: form.active,
        product_ids: form.product_ids,
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
      product_ids: c.product_ids ?? [],
    });
    setOpen(true);
  };

  const toggleProduct = (id: string) => {
    setForm((f) => ({
      ...f,
      product_ids: f.product_ids.includes(id)
        ? f.product_ids.filter((p) => p !== id)
        : [...f.product_ids, id],
    }));
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

                <div className="text-xs text-muted-foreground">
                  {(c.product_ids ?? []).length === 0
                    ? "⚠️ Sem produtos vinculados — não dispara"
                    : `Dispara apenas em ${(c.product_ids ?? []).length} produto(s) selecionado(s)`}
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
          <Accordion type="multiple" className="space-y-3">
            {logs.map((log) => (
              <AccordionItem
                key={log.id}
                value={log.id}
                className="rounded-2xl border bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap w-full pr-2">
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
                </AccordionTrigger>
                <AccordionContent>
                  {log.error && (
                    <div className="text-xs text-rose-500 mb-2">{log.error}</div>
                  )}
                  <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-x-auto">
{JSON.stringify(log.payload, null, 2)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>
                  Produtos <span className="text-rose-500">*</span>
                </Label>
                <span className="text-xs text-muted-foreground">
                  {form.product_ids.length === 0
                    ? "Nenhum selecionado"
                    : `${form.product_ids.length} selecionado(s)`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Selecione ao menos 1 produto. O webhook só dispara para os produtos escolhidos.
              </p>
              <div className="max-h-44 overflow-y-auto rounded-md border p-2 space-y-1">
                {productsQ.isLoading ? (
                  <div className="text-xs text-muted-foreground p-2">
                    Carregando produtos…
                  </div>
                ) : (productsQ.data ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground p-2">
                    Nenhum produto cadastrado.
                  </div>
                ) : (
                  (productsQ.data ?? []).map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={form.product_ids.includes(p.id)}
                        onCheckedChange={() => toggleProduct(p.id)}
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))
                )}
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
