import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { subscribeAdminPush } from "@/lib/push.functions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push-config";
import { toast } from "sonner";

type Status = "loading" | "unsupported" | "iframe" | "denied" | "default" | "granted";

export function EnableAdminPush() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const subscribeFn = useServerFn(subscribeAdminPush);

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
    try {
      const perm = await Notification.requestPermission();
      setStatus(perm as Status);
      if (perm !== "granted") {
        toast.error(perm === "denied"
          ? "Permissão negada. Habilite nas configurações do navegador."
          : "Permissão não concedida.");
        return;
      }

      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
      reg = await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }
      const json = sub.toJSON();
      await subscribeFn({
        data: {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent.slice(0, 500),
        },
      });
      toast.success("Notificações ativadas! Você será avisado a cada nova venda.");
    } catch (err) {
      toast.error("Erro: " + (err as Error).message);
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
  if (status === "granted") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Notificações de novas vendas ativadas
      </div>
    );
  }
  if (status === "denied") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <BellOff className="h-4 w-4" />
        Notificações bloqueadas. Habilite nas configurações do navegador.
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm">
        <Bell className="h-4 w-4 text-primary" />
        <span>Ative as notificações para ser avisado de cada nova venda</span>
      </div>
      <Button size="sm" onClick={enable} disabled={busy}>
        {busy ? "Ativando..." : "Ativar"}
      </Button>
    </div>
  );
}
