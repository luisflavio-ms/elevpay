import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Save,
  Trash2,
  Plus,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { brl, db, seedIfNeeded, slugify } from "@/lib/store";
import type { Checkout, Product, OrderBump, CheckoutBlock } from "@/lib/types";
import { BlockBuilder } from "@/components/checkout/BlockBuilder";
import { BlockRenderer } from "@/components/checkout/BlockRenderer";

export const Route = createFileRoute("/app/checkouts/$id")({
  component: Builder,
});

function Builder() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [bumps, setBumps] = useState<OrderBump[]>([]);

  useEffect(() => {
    seedIfNeeded();
    const c = db.getCheckouts().find((x) => x.id === id) ?? null;
    setCheckout(c);
    setProducts(db.getProducts());
    setBumps(db.getBumps());
  }, [id]);

  if (!checkout) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Checkout não encontrado.</p>
        <Link to="/app/checkouts"><Button variant="link">Voltar</Button></Link>
      </div>
    );
  }

  const update = <K extends keyof Checkout>(k: K, v: Checkout[K]) =>
    setCheckout({ ...checkout, [k]: v });

  const save = (silent = false) => {
    const list = db.getCheckouts();
    const next = list.map((c) => (c.id === checkout.id ? checkout : c));
    db.setCheckouts(next);
    if (!silent) toast.success("Checkout salvo");
  };

  const publish = () => {
    update("active", true);
    const next = db.getCheckouts().map((c) =>
      c.id === checkout.id ? { ...checkout, active: true } : c,
    );
    db.setCheckouts(next);
    toast.success("Checkout publicado!");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/checkout/${checkout.slug}`);
    toast.success("Link copiado");
  };

  const remove = () => {
    db.setCheckouts(db.getCheckouts().filter((c) => c.id !== checkout.id));
    toast.success("Checkout excluído");
    nav({ to: "/app/checkouts" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/app/checkouts" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => save()}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
          <Button size="sm" onClick={publish}>Publicar</Button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden">
        <Tabs defaultValue="config">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="publish">Publicar</TabsTrigger>
          </TabsList>
          <TabsContent value="config" className="mt-4">
            <ConfigPanel checkout={checkout} update={update} products={products} bumps={bumps} />
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            <PreviewPanel checkout={checkout} products={products} bumps={bumps} />
          </TabsContent>
          <TabsContent value="publish" className="mt-4">
            <PublishPanel checkout={checkout} onCopy={copyLink} onRemove={remove} onPublish={publish} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop 3 columns */}
      <div className="hidden lg:grid grid-cols-12 gap-4">
        <div className="col-span-4 max-h-[calc(100vh-150px)] overflow-y-auto pr-2">
          <ConfigPanel checkout={checkout} update={update} products={products} bumps={bumps} />
        </div>
        <div className="col-span-5">
          <PreviewPanel checkout={checkout} products={products} bumps={bumps} />
        </div>
        <div className="col-span-3">
          <PublishPanel checkout={checkout} onCopy={copyLink} onRemove={remove} onPublish={publish} />
        </div>
      </div>
    </div>
  );
}

/* ----------------- Config ----------------- */
function ConfigPanel({
  checkout, update, products, bumps,
}: {
  checkout: Checkout;
  update: <K extends keyof Checkout>(k: K, v: Checkout[K]) => void;
  products: Product[];
  bumps: OrderBump[];
}) {
  const setBenefit = (i: number, v: string) => {
    const next = [...checkout.benefits];
    next[i] = v;
    update("benefits", next);
  };
  const addBenefit = () => update("benefits", [...checkout.benefits, ""]);
  const rmBenefit = (i: number) => update("benefits", checkout.benefits.filter((_, x) => x !== i));

  const addTesti = () =>
    update("testimonials", [...checkout.testimonials, { name: "", text: "" }]);
  const setTesti = (i: number, k: "name" | "text", v: string) => {
    const next = [...checkout.testimonials];
    next[i] = { ...next[i], [k]: v };
    update("testimonials", next);
  };
  const rmTesti = (i: number) => update("testimonials", checkout.testimonials.filter((_, x) => x !== i));

  return (
    <div className="space-y-4">
      <Section title="Informações">
        <F label="Nome do checkout">
          <Input value={checkout.name} onChange={(e) => update("name", e.target.value)} />
        </F>
        <F label="Slug (URL)">
          <Input value={checkout.slug} onChange={(e) => update("slug", slugify(e.target.value))} />
        </F>
        <F label="Produto vinculado">
          <Select value={checkout.productId} onValueChange={(v) => update("productId", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </F>
      </Section>

      <Section title="Blocos do checkout (arraste para reordenar)">
        <BlockBuilder
          blocks={checkout.blocks ?? []}
          onChange={(b: CheckoutBlock[]) => update("blocks", b)}
        />
      </Section>

      <Section title="Conteúdo">

        <F label="Headline"><Input value={checkout.headline} onChange={(e) => update("headline", e.target.value)} /></F>
        <F label="Subheadline"><Input value={checkout.subheadline} onChange={(e) => update("subheadline", e.target.value)} /></F>
        <F label="Imagem (URL)"><Input value={checkout.image} onChange={(e) => update("image", e.target.value)} /></F>
        <F label="Garantia"><Input value={checkout.guarantee} onChange={(e) => update("guarantee", e.target.value)} /></F>
      </Section>

      <Section title="Benefícios">
        {checkout.benefits.map((b, i) => (
          <div key={i} className="flex gap-2">
            <Input value={b} onChange={(e) => setBenefit(i, e.target.value)} />
            <Button size="icon" variant="ghost" onClick={() => rmBenefit(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addBenefit}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar benefício
        </Button>
      </Section>

      <Section title="Depoimentos">
        {checkout.testimonials.map((t, i) => (
          <div key={i} className="space-y-2 p-3 border rounded-lg">
            <Input placeholder="Nome" value={t.name} onChange={(e) => setTesti(i, "name", e.target.value)} />
            <Textarea placeholder="Texto" rows={2} value={t.text} onChange={(e) => setTesti(i, "text", e.target.value)} />
            <Button size="sm" variant="ghost" onClick={() => rmTesti(i)}>
              <Trash2 className="h-4 w-4 mr-1" /> Remover
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addTesti}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar depoimento
        </Button>
      </Section>

      <Section title="Aparência">
        <F label="Cor principal">
          <div className="flex gap-2">
            <Input type="color" className="w-16 h-10 p-1" value={checkout.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
            <Input value={checkout.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
          </div>
        </F>
        <F label="Texto do botão"><Input value={checkout.buttonText} onChange={(e) => update("buttonText", e.target.value)} /></F>
      </Section>

      <Section title="Pagamento">
        <Toggle label="Pix" checked={checkout.paymentMethods.pix} onChange={(v) => update("paymentMethods", { ...checkout.paymentMethods, pix: v })} />
        <Toggle label="Cartão" checked={checkout.paymentMethods.card} onChange={(v) => update("paymentMethods", { ...checkout.paymentMethods, card: v })} />
        <Toggle label="Boleto" checked={checkout.paymentMethods.boleto} onChange={(v) => update("paymentMethods", { ...checkout.paymentMethods, boleto: v })} />
      </Section>

      <Section title="Order bump">
        <Select
          value={checkout.orderBumpId ?? "none"}
          onValueChange={(v) => update("orderBumpId", v === "none" ? undefined : v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {bumps.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.title} — {brl(b.price)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>

      <Section title="Conversão & Urgência">
        <F label="Timer de escassez (min)">
          <Input type="number" value={checkout.scarcityTimerMinutes} onChange={(e) => update("scarcityTimerMinutes", Number(e.target.value))} />
        </F>
        <F label="Mensagem de urgência"><Input value={checkout.urgencyMessage} onChange={(e) => update("urgencyMessage", e.target.value)} /></F>
        <Toggle label="Selo de compra segura" checked={checkout.secureSeal} onChange={(v) => update("secureSeal", v)} />
      </Section>

      <Section title="Integrações">
        <F label="Pixel Meta"><Input value={checkout.pixelMeta} onChange={(e) => update("pixelMeta", e.target.value)} /></F>
        <F label="Pixel Google"><Input value={checkout.pixelGoogle} onChange={(e) => update("pixelGoogle", e.target.value)} /></F>
        <F label="Webhook URL"><Input value={checkout.webhookUrl} onChange={(e) => update("webhookUrl", e.target.value)} /></F>
        <F label="Redirecionamento pós-compra"><Input value={checkout.redirectUrl} onChange={(e) => update("redirectUrl", e.target.value)} /></F>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        {children}
      </CardContent>
    </Card>
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
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/* ----------------- Preview ----------------- */
function PreviewPanel({
  checkout, products, bumps,
}: { checkout: Checkout; products: Product[]; bumps: OrderBump[] }) {
  const product = products.find((p) => p.id === checkout.productId);
  const bump = bumps.find((b) => b.id === checkout.orderBumpId);
  return (
    <Card className="rounded-2xl sticky top-4">
      <CardContent className="p-0 overflow-hidden">
        <div className="bg-muted/40 p-2 text-[10px] text-muted-foreground text-center border-b">
          Preview do checkout
        </div>
        <div className="bg-white text-slate-900 p-4 max-h-[700px] overflow-y-auto">
          {(checkout.blocks ?? []).length > 0 && (
            <div className="space-y-3 mb-3">
              {(checkout.blocks ?? []).map((b) => (
                <BlockRenderer key={b.id} block={b} color={checkout.primaryColor} />
              ))}
            </div>
          )}
          {checkout.scarcityTimerMinutes > 0 && (
            <div className="text-center text-xs py-2 px-3 mb-3 rounded-lg" style={{ background: checkout.primaryColor + "20", color: checkout.primaryColor }}>
              <Clock className="inline h-3 w-3 mr-1" />
              Oferta expira em {checkout.scarcityTimerMinutes}:00
            </div>
          )}
          {checkout.image && (
            <img src={checkout.image} alt="" className="w-full aspect-video object-cover rounded-lg mb-3" loading="lazy" />
          )}
          <h2 className="text-xl font-bold leading-tight">{checkout.headline}</h2>
          {checkout.subheadline && <p className="text-sm text-slate-600 mt-1">{checkout.subheadline}</p>}
          {product && (
            <div className="my-4 p-3 border rounded-lg flex items-center justify-between">
              <span className="text-sm">{product.name}</span>
              <span className="text-xl font-bold" style={{ color: checkout.primaryColor }}>{brl(product.price)}</span>
            </div>
          )}
          {checkout.benefits.length > 0 && (
            <ul className="space-y-1.5 text-sm mb-4">
              {checkout.benefits.filter(Boolean).map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span style={{ color: checkout.primaryColor }}>✓</span>{b}
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 mb-3">
            <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Nome completo" />
            <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="E-mail" />
            <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="WhatsApp" />
          </div>
          {bump && (
            <div className="p-3 border-2 border-dashed rounded-lg mb-3" style={{ borderColor: checkout.primaryColor }}>
              <p className="text-xs font-semibold" style={{ color: checkout.primaryColor }}>OFERTA ESPECIAL</p>
              <p className="text-sm font-medium">{bump.title}</p>
              <p className="text-xs text-slate-600">{bump.description}</p>
              <p className="text-sm font-bold mt-1">+ {brl(bump.price)}</p>
            </div>
          )}
          <button className="w-full py-3 rounded-lg text-white font-semibold text-sm" style={{ background: checkout.primaryColor }}>
            {checkout.buttonText}
          </button>
          {checkout.secureSeal && (
            <p className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Compra 100% segura
            </p>
          )}
          {checkout.guarantee && (
            <p className="text-xs text-slate-600 text-center mt-1">🛡️ {checkout.guarantee}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------- Publish ----------------- */
function PublishPanel({
  checkout, onCopy, onRemove, onPublish,
}: { checkout: Checkout; onCopy: () => void; onRemove: () => void; onPublish: () => void }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/checkout/${checkout.slug}` : "";
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Status</h3>
            <Badge variant={checkout.active ? "default" : "secondary"}>
              {checkout.active ? "Ativo" : "Rascunho"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground break-all">{url}</p>
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={onPublish}>Publicar checkout</Button>
            <Button size="sm" variant="outline" onClick={onCopy}>
              <Copy className="h-4 w-4 mr-1" /> Copiar link
            </Button>
            <Link to="/checkout/$slug" params={{ slug: checkout.slug }} target="_blank">
              <Button size="sm" variant="outline" className="w-full">
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir checkout
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-destructive/30">
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-sm text-destructive">Zona perigosa</h3>
          <Button size="sm" variant="destructive" className="w-full" onClick={onRemove}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir checkout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
