import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { subscribeAdminPush, sendTestPush } from "@/lib/push.functions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push-config";
import { toast } from "sonner";

type Status = "loading" | "unsupported" | "iframe" | "denied" | "default" | "granted";

export function EnableAdminPush() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const subscribeFn = useServerFn(subscribeAdminPush);
  const testFn = useServerFn(sendTestPush);
  const canEnable = status === "default" || status === "granted";

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await testFn({ data: undefined });
      if (res.ok) {
        toast.success(`Enviado para ${res.sent}/${res.total} dispositivo(s)`);
      } else {
        toast.error(`Falhou: ${res.error || JSON.stringify(res.results)}`);
        console.warn("[push] test result", res);
      }
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    } finally {
      setTesting(false);
    }
  };


  useEffect(() => {
    const inIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    if (inIframe) { setStatus("iframe"); return; }
    if (typeof Notification === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as Status);
  }, []);

  const enable = async () => {
    setBusy(true);
    setLastError(null);
    let step = "start";
    try {
      step = "requestPermission";
      const perm = await Notification.requestPermission();
      setStatus(perm as Status);
      if (perm !== "granted") {
        toast.error(perm === "denied"
          ? "Permissão negada. Habilite em Ajustes → Notificações → ElevPay."
          : "Permissão não concedida.");
        return;
      }

      step = "registerSW";
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
      reg = await navigator.serviceWorker.ready;

      step = "unsubscribeOld";
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        try { await existingSub.unsubscribe(); } catch (e) { console.warn(e); }
      }

      step = "subscribe";
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Assinatura sem chaves p256dh/auth");
      }

      step = "saveServer";
      await subscribeFn({
        data: {
          endpoint: sub.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          userAgent: navigator.userAgent.slice(0, 500),
        },
      });
      setStatus("granted");
      toast.success("Notificações ativadas!");
    } catch (err) {
      const message = (err as Error)?.message || String(err);
      setLastError(`[${step}] ${message}`);
      toast.error(`Falha em "${step}": ${message}`);
      console.error("[push] enable failed", step, err);
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return null;
  if (status === "iframe") {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        🔔 Para receber notificações de novas vendas, abra o app publicado (instale na tela inicial do celular).
      </div>
    );
  }
  if (status === "unsupported") {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Seu navegador não suporta notificações push.
      </div>
    );
  }

  const errorBox = lastError ? (
    <div className="mt-2 break-all rounded-md bg-destructive/10 p-2 text-[11px] text-destructive">
      {lastError}
    </div>
  ) : null;

  if (status === "granted") {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>Notificações de novas vendas ativadas</span>
          </div>
          <Button size="sm" variant="outline" onClick={enable} disabled={busy}>
            {busy ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
        {errorBox}
      </div>
    );
  }
  if (status === "denied") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <BellOff className="h-4 w-4" />
        Notificações bloqueadas. Habilite em Ajustes → Notificações → ElevPay.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4 text-primary" />
          <span>Ative as notificações para ser avisado de cada nova venda</span>
        </div>
        <Button size="sm" onClick={enable} disabled={busy || !canEnable}>
          {busy ? "Ativando..." : "Ativar"}
        </Button>
      </div>
      {errorBox}
    </div>
  );
}
