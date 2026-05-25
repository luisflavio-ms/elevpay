import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Save, Lock, User, IdCard, Calendar, MapPin, Map, Mail, Phone, Link2, Percent, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/configuracoes")({
  component: ProfilePage,
});

type Profile = {
  id: string;
  full_name: string | null;
  cpf: string | null;
  birth_date: string | null;
  email: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notifications_enabled: boolean;
  support_email: string | null;
  support_whatsapp: string | null;
  support_social: string | null;
};

const FEE_PER_SALE = 0.99;
const ORDER_BUMP_FEE = 0.5;

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,cpf,birth_date,email,whatsapp,address,city,state,notifications_enabled,support_email,support_whatsapp,support_social")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const p = profileQ.data;

  const updateM = useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  // dialogs
  const [editPersonal, setEditPersonal] = useState(false);
  const [editAddress, setEditAddress] = useState(false);
  const [editCreds, setEditCreds] = useState(false);
  const [editPwd, setEditPwd] = useState(false);
  const [editSupport, setEditSupport] = useState(false);

  if (!user) return null;
  if (profileQ.isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
      </div>

      <Tabs defaultValue="visao" className="w-full">
        <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start h-auto p-0 gap-6">
          <TabsTrigger value="visao" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 pb-3">Visão geral</TabsTrigger>
          <TabsTrigger value="conta" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 pb-3">Conta</TabsTrigger>
          <TabsTrigger value="op" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 pb-3">Operações</TabsTrigger>
        </TabsList>

        {/* VISÃO GERAL */}
        <TabsContent value="visao" className="space-y-4 mt-6">
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Dados pessoais</h2>
                <Button variant="outline" size="sm" onClick={() => setEditPersonal(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field icon={<User className="h-4 w-4" />} label="Nome" value={p?.full_name} />
                <Field icon={<IdCard className="h-4 w-4" />} label="CPF" value={p?.cpf} />
                <Field icon={<Calendar className="h-4 w-4" />} label="Data de nascimento" value={fmtDate(p?.birth_date)} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Endereço</h2>
                <Button variant="outline" size="sm" onClick={() => setEditAddress(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Mantenha o endereço atualizado para refletir nas funcionalidades da plataforma e no recebimento de premiações.
              </p>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field icon={<MapPin className="h-4 w-4" />} label="Endereço" value={p?.address} />
                <Field icon={<Map className="h-4 w-4" />} label="Cidade / Estado" value={joinCityState(p?.city, p?.state)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTA */}
        <TabsContent value="conta" className="space-y-4 mt-6">
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Credenciais</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditCreds(true)}>
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setEditPwd(true)}>
                    <Lock className="h-4 w-4 mr-1" /> Alterar senha
                  </Button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field icon={<Mail className="h-4 w-4" />} label="E-mail" value={p?.email ?? user.email} />
                <Field icon={<Phone className="h-4 w-4" />} label="Whatsapp" value={p?.whatsapp} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Preferências</h2>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Receber notificações</p>
                  <p className="text-xs text-muted-foreground">Alertas sobre vendas, novidades e atualizações.</p>
                </div>
                <Switch
                  checked={!!p?.notifications_enabled}
                  onCheckedChange={(v) => updateM.mutate({ notifications_enabled: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPERAÇÕES */}
        <TabsContent value="op" className="space-y-4 mt-6">
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-5">
              <h2 className="text-lg font-semibold">Taxas</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field icon={<Percent className="h-4 w-4" />} label="Taxa por venda" value={brl(FEE_PER_SALE)} />
                <Field icon={<ShoppingBag className="h-4 w-4" />} label="Order bump" value={brl(ORDER_BUMP_FEE)} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Canais de atendimento</h2>
                <Button variant="outline" size="sm" onClick={() => setEditSupport(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                <Field icon={<Mail className="h-4 w-4" />} label="E-mail para suporte" value={p?.support_email} placeholder="Não informado" />
                <Field icon={<Phone className="h-4 w-4" />} label="Whatsapp para suporte" value={p?.support_whatsapp} placeholder="Não informado" />
                <Field icon={<Link2 className="h-4 w-4" />} label="Rede social para suporte" value={p?.support_social} placeholder="Não informado" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditPersonalDialog open={editPersonal} onClose={() => setEditPersonal(false)} profile={p} onSave={(patch) => updateM.mutateAsync(patch).then(() => setEditPersonal(false))} />
      <EditAddressDialog open={editAddress} onClose={() => setEditAddress(false)} profile={p} onSave={(patch) => updateM.mutateAsync(patch).then(() => setEditAddress(false))} />
      <EditCredsDialog open={editCreds} onClose={() => setEditCreds(false)} profile={p} fallbackEmail={user.email ?? ""} onSave={(patch) => updateM.mutateAsync(patch).then(() => setEditCreds(false))} />
      <EditPasswordDialog open={editPwd} onClose={() => setEditPwd(false)} />
      <EditSupportDialog open={editSupport} onClose={() => setEditSupport(false)} profile={p} onSave={(patch) => updateM.mutateAsync(patch).then(() => setEditSupport(false))} />
    </div>
  );
}

function Field({ icon, label, value, placeholder }: { icon: React.ReactNode; label: string; value?: string | null; placeholder?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {value ? (
          <p className="font-medium truncate">{value}</p>
        ) : (
          <p className="italic text-muted-foreground">{placeholder ?? "Não informado"}</p>
        )}
      </div>
    </div>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}
function joinCityState(c?: string | null, s?: string | null) {
  if (!c && !s) return null;
  return [c, s].filter(Boolean).join(" / ");
}
function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ---------------- Dialogs ---------------- */

function EditPersonalDialog({ open, onClose, profile, onSave }: { open: boolean; onClose: () => void; profile: Profile | null | undefined; onSave: (p: Partial<Profile>) => Promise<unknown> }) {
  const [f, setF] = useState({ full_name: "", cpf: "", birth_date: "" });
  useEffect(() => {
    if (open) setF({ full_name: profile?.full_name ?? "", cpf: profile?.cpf ?? "", birth_date: profile?.birth_date ?? "" });
  }, [open, profile]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dados pessoais</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FormRow label="Nome"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></FormRow>
          <FormRow label="CPF"><Input value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></FormRow>
          <FormRow label="Data de nascimento"><Input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></FormRow>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ full_name: f.full_name || null, cpf: f.cpf || null, birth_date: f.birth_date || null })}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAddressDialog({ open, onClose, profile, onSave }: { open: boolean; onClose: () => void; profile: Profile | null | undefined; onSave: (p: Partial<Profile>) => Promise<unknown> }) {
  const [f, setF] = useState({ address: "", city: "", state: "" });
  useEffect(() => {
    if (open) setF({ address: profile?.address ?? "", city: profile?.city ?? "", state: profile?.state ?? "" });
  }, [open, profile]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Endereço</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FormRow label="Endereço"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Cidade"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></FormRow>
            <FormRow label="Estado"><Input value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} /></FormRow>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ address: f.address || null, city: f.city || null, state: f.state || null })}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCredsDialog({ open, onClose, profile, fallbackEmail, onSave }: { open: boolean; onClose: () => void; profile: Profile | null | undefined; fallbackEmail: string; onSave: (p: Partial<Profile>) => Promise<unknown> }) {
  const [f, setF] = useState({ email: "", whatsapp: "" });
  useEffect(() => {
    if (open) setF({ email: profile?.email ?? fallbackEmail ?? "", whatsapp: profile?.whatsapp ?? "" });
  }, [open, profile, fallbackEmail]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Credenciais</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FormRow label="E-mail"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormRow>
          <FormRow label="Whatsapp"><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></FormRow>
          <p className="text-xs text-muted-foreground">O e-mail de login só pode ser alterado em "Alterar senha".</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ email: f.email || null, whatsapp: f.whatsapp || null })}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setPwd(""); setPwd2(""); } }, [open]);
  const save = async () => {
    if (pwd.length < 6) return toast.error("Mínimo de 6 caracteres");
    if (pwd !== pwd2) return toast.error("Senhas não coincidem");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Senha alterada");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Alterar senha</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FormRow label="Nova senha"><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></FormRow>
          <FormRow label="Confirmar nova senha"><Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} /></FormRow>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}><Lock className="h-4 w-4 mr-1" /> Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditSupportDialog({ open, onClose, profile, onSave }: { open: boolean; onClose: () => void; profile: Profile | null | undefined; onSave: (p: Partial<Profile>) => Promise<unknown> }) {
  const [f, setF] = useState({ support_email: "", support_whatsapp: "", support_social: "" });
  useEffect(() => {
    if (open) setF({
      support_email: profile?.support_email ?? "",
      support_whatsapp: profile?.support_whatsapp ?? "",
      support_social: profile?.support_social ?? "",
    });
  }, [open, profile]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Canais de atendimento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FormRow label="E-mail para suporte"><Input type="email" value={f.support_email} onChange={(e) => setF({ ...f, support_email: e.target.value })} /></FormRow>
          <FormRow label="Whatsapp para suporte"><Input value={f.support_whatsapp} onChange={(e) => setF({ ...f, support_whatsapp: e.target.value })} /></FormRow>
          <FormRow label="Rede social para suporte"><Input placeholder="https://..." value={f.support_social} onChange={(e) => setF({ ...f, support_social: e.target.value })} /></FormRow>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({
            support_email: f.support_email || null,
            support_whatsapp: f.support_whatsapp || null,
            support_social: f.support_social || null,
          })}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
