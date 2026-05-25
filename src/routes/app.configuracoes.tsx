import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, seedIfNeeded } from "@/lib/store";
import type { Settings } from "@/lib/types";

export const Route = createFileRoute("/app/configuracoes")({
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);

  useEffect(() => {
    seedIfNeeded();
    setS(db.getSettings());
  }, []);

  if (!s) return null;
  const upd = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  const save = () => {
    db.setSettings(s);
    toast.success("Configurações salvas");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da sua conta e empresa</p>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <F label="Nome da empresa"><Input value={s.companyName} onChange={(e) => upd("companyName", e.target.value)} /></F>
          <F label="Logo (URL)"><Input value={s.logo} onChange={(e) => upd("logo", e.target.value)} /></F>
          <F label="Domínio personalizado"><Input value={s.customDomain} onChange={(e) => upd("customDomain", e.target.value)} /></F>
          <F label="Taxa (%)">
            <Input type="number" step="0.01" value={s.feePercent} onChange={(e) => upd("feePercent", Number(e.target.value))} />
          </F>
          <F label="Dados de saque"><Input value={s.withdrawAccount} onChange={(e) => upd("withdrawAccount", e.target.value)} /></F>
          <F label="Chave Pix"><Input value={s.pixKey} onChange={(e) => upd("pixKey", e.target.value)} /></F>
          <Button onClick={save}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
