import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Save,
  Trash2,
  Plus,
  X,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { brl } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { rowToCheckout, checkoutToRow, type CheckoutRow } from "@/lib/checkout-mapper";
import type { Checkout, Product, OrderBump, CheckoutBlock, CheckoutBlockType } from "@/lib/types";
import { BlockBuilder, Palette, BlockEditor, CANVAS_ID } from "@/components/checkout/BlockBuilder";
import { BlockRenderer } from "@/components/checkout/BlockRenderer";
import { BLOCK_ICONS, BLOCK_LABELS, createBlock } from "@/components/checkout/blockDefaults";
import { checkoutOrigin } from "@/lib/domains";

export const Route = createFileRoute("/app/checkouts/$id")({
  component: Builder,
});

function Builder() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [checkout, setCheckout] = useState<Checkout | null>(null);

  const checkoutQ = useQuery({
    queryKey: ["checkout", id],
    queryFn: async (): Promise<Checkout | null> => {
      const { data, error } = await supabase
        .from("checkouts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToCheckout(data as unknown as CheckoutRow) : null;
    },
  });

  const productsQ = useQuery({
    queryKey: ["products", "all-for-builder"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,description,image,type,delivery_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description as string) ?? "",
        image: (r.image as string) ?? "",
        type: r.type as Product["type"],
        deliveryUrl: (r.delivery_url as string) ?? "",
      }));
    },
  });

  const bumpsQ = useQuery({
    queryKey: ["order_bumps"],
    queryFn: async (): Promise<OrderBump[]> => {
      const { data, error } = await supabase
        .from("order_bumps")
        .select("id,title,description,price")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        description: (r.description as string) ?? "",
        price: Number(r.price),
      }));
    },
  });

  useEffect(() => {
    if (checkoutQ.data) setCheckout(checkoutQ.data);
  }, [checkoutQ.data]);

  const products = productsQ.data ?? [];
  const bumps = bumpsQ.data ?? [];

  if (checkoutQ.isLoading) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Carregando...</div>;
  }

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

  const persistCheckout = async (c: Checkout) => {
    if (!user) throw new Error("Não autenticado");
    const row = checkoutToRow(c, user.id);
    const { id: _ignore, ...payload } = row;
    const { error } = await supabase
      .from("checkouts")
      .update(payload as never)
      .eq("id", c.id);
    if (error) throw error;
  };

  const save = async (silent = false) => {
    try {
      await persistCheckout(checkout);
      if (!silent) toast.success("Checkout salvo");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const publish = async () => {
    const next = { ...checkout, active: true };
    setCheckout(next);
    try {
      await persistCheckout(next);
      toast.success("Checkout publicado!");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${checkoutOrigin()}/checkout/${checkout.publicId}`);
    toast.success("Link copiado");
  };

  const remove = async () => {
    const { error } = await supabase.from("checkouts").delete().eq("id", checkout.id);
    if (error) return toast.error(error.message);
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

      {/* Desktop 3 columns - palette / preview / editor */}
      <div className="hidden lg:block">
        <DesktopBuilder
          checkout={checkout}
          update={update}
          products={products}
          bumps={bumps}
          onCopy={copyLink}
          onRemove={remove}
          onPublish={publish}
        />
      </div>
    </div>
  );
}

/* ----------------- Config ----------------- */
function ConfigPanel({
  checkout, update, products, bumps, compact = false,
}: {
  checkout: Checkout;
  update: <K extends keyof Checkout>(k: K, v: Checkout[K]) => void;
  products: Product[];
  bumps: OrderBump[];
  compact?: boolean;
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
    <Tabs defaultValue="config" className="space-y-4">
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="config">Configuração</TabsTrigger>
        <TabsTrigger value="visual">Visual</TabsTrigger>
      </TabsList>

      <TabsContent value="config" className="space-y-4 mt-0">
        <Section title="Informações">
          <F label="Nome do checkout">
            <Input value={checkout.name} onChange={(e) => update("name", e.target.value)} />
          </F>
          <F label="Preço (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={checkout.amount}
              onChange={(e) => update("amount", Number(e.target.value) || 0)}
            />
          </F>
          <F label="Link público">
            <Input value={`/checkout/${checkout.publicId}`} readOnly />
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

        <PriceVariantsSection checkoutId={checkout.id} />

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
      </TabsContent>



      <TabsContent value="visual" className="space-y-4 mt-0">
        {!compact && (
          <Section title="Blocos do checkout (arraste para reordenar)">
            <BlockBuilder
              blocks={checkout.blocks ?? []}
              onChange={(b: CheckoutBlock[]) => update("blocks", b)}
            />
          </Section>
        )}

        <Section title="Aparência">
          <F label="Cor principal">
            <div className="flex gap-2">
              <Input type="color" className="w-16 h-10 p-1" value={checkout.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
              <Input value={checkout.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
            </div>
          </F>
          <F label="Texto do botão"><Input value={checkout.buttonText} onChange={(e) => update("buttonText", e.target.value)} /></F>
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
      </TabsContent>
    </Tabs>
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
  checkout, products, bumps, selectedId, onSelect, onRemoveBlock, isDraggingPalette,
}: {
  checkout: Checkout;
  products: Product[];
  bumps: OrderBump[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onRemoveBlock?: (id: string) => void;
  isDraggingPalette?: boolean;
}) {
  const product = products.find((p) => p.id === checkout.productId);
  const bump = bumps.find((b) => b.id === checkout.orderBumpId);
  const interactive = !!onSelect;
  const blocks = checkout.blocks ?? [];
  return (
    <Card className="rounded-2xl sticky top-4">
      <CardContent className="p-0 overflow-hidden">
        <div className="bg-muted/40 p-2 text-[10px] text-muted-foreground text-center border-b">
          Preview do checkout {interactive && "— clique em um bloco para editar"}
        </div>
        <div className="bg-white text-slate-900 p-4 max-h-[700px] overflow-y-auto">
          {interactive ? (
            <div className="mb-3">
              <PreviewBlocksDrop
                blocks={blocks}
                color={checkout.primaryColor}
                selectedId={selectedId ?? null}
                onSelect={(id) => onSelect!(id)}
                onRemoveBlock={(id) => onRemoveBlock?.(id)}
                isDraggingPalette={!!isDraggingPalette}
              />
            </div>
          ) : (
            blocks.length > 0 && (
              <div className="space-y-3 mb-3">
                {blocks.map((b) => (
                  <BlockRenderer key={b.id} block={b} color={checkout.primaryColor} />
                ))}
              </div>
            )
          )}
          {product && (
            <div className="my-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-slate-900"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 12h2"/></svg>
                <h3 className="text-xs font-bold tracking-wider text-slate-900">RESUMO DO PEDIDO</h3>
              </div>
              <div className="flex items-center gap-3">
                {product.image && (
                  <img src={product.image} alt={product.name} className="h-14 w-14 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                )}
                <p className="text-sm font-semibold text-slate-900 leading-snug flex-1 min-w-0">{product.name}</p>
              </div>
              <div className="mt-3 text-right">
                <p className="text-base font-extrabold" style={{ color: checkout.primaryColor }}>
                  Total {brl(checkout.amount)}
                </p>
              </div>
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
          {checkout.guarantee && (
            <p className="text-xs text-slate-600 text-center mt-3">🛡️ {checkout.guarantee}</p>
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
  const url = typeof window !== "undefined" ? `${checkoutOrigin()}/checkout/${checkout.publicId}` : "";
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
            <Link to="/checkout/$publicId" params={{ publicId: checkout.publicId }} target="_blank">
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

/* ----------------- Desktop Builder (DnD) ----------------- */
function DesktopBuilder({
  checkout, update, products, bumps, onCopy, onRemove, onPublish,
}: {
  checkout: Checkout;
  update: <K extends keyof Checkout>(k: K, v: Checkout[K]) => void;
  products: Product[];
  bumps: OrderBump[];
  onCopy: () => void;
  onRemove: () => void;
  onPublish: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<
    | { kind: "palette"; type: CheckoutBlockType }
    | { kind: "sort"; id: string }
    | null
  >(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const blocks = checkout.blocks ?? [];
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const setBlocks = (b: CheckoutBlock[]) => update("blocks", b);
  const updateBlock = (id: string, patch: Partial<CheckoutBlock>) =>
    setBlocks(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as CheckoutBlock) : b)));
  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const addBlock = (t: CheckoutBlockType, atIndex?: number) => {
    const nb = createBlock(t);
    if (atIndex == null || atIndex >= blocks.length) {
      setBlocks([...blocks, nb]);
    } else {
      const next = [...blocks];
      next.splice(Math.max(0, atIndex), 0, nb);
      setBlocks(next);
    }
    setSelectedId(nb.id);
  };

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { source?: string; type?: CheckoutBlockType } | undefined;
    if (data?.source === "palette" && data.type) {
      setActiveDrag({ kind: "palette", type: data.type });
    } else {
      setActiveDrag({ kind: "sort", id: String(e.active.id) });
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const data = active.data.current as { source?: string; type?: CheckoutBlockType } | undefined;

    if (data?.source === "palette" && data.type) {
      if (over.id === CANVAS_ID) {
        addBlock(data.type);
        return;
      }
      const idx = blocks.findIndex((b) => b.id === over.id);
      addBlock(data.type, idx < 0 ? undefined : idx);
      return;
    }

    if (active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setBlocks(arrayMove(blocks, oldIdx, newIdx));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT - Palette */}
        <div className="col-span-2">
          <Card className="rounded-2xl sticky top-4">
            <CardContent className="p-3">
              <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">
                Arraste para o preview
              </p>
              <Palette onAdd={(t) => addBlock(t)} orientation="stack" />
            </CardContent>
          </Card>
        </div>

        {/* MIDDLE - Preview with selectable blocks */}
        <div className="col-span-6">
          <PreviewPanel
            checkout={checkout}
            products={products}
            bumps={bumps}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemoveBlock={removeBlock}
            isDraggingPalette={activeDrag?.kind === "palette"}
          />
        </div>

        {/* RIGHT - Editor or Config */}
        <div className="col-span-4 max-h-[calc(100vh-150px)] overflow-y-auto pr-2">
          {selected ? (
            <Card className="rounded-2xl sticky top-4">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = BLOCK_ICONS[selected.type];
                      return <Icon className="h-4 w-4 text-primary" />;
                    })()}
                    <h3 className="font-semibold text-sm">Editar — {BLOCK_LABELS[selected.type]}</h3>
                  </div>
                  <button onClick={() => setSelectedId(null)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <BlockEditor block={selected} onUpdate={(patch) => updateBlock(selected.id, patch)} />
                </div>
                <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={() => removeBlock(selected.id)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Remover bloco
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <ConfigPanel checkout={checkout} update={update} products={products} bumps={bumps} compact />
              <PublishPanel checkout={checkout} onCopy={onCopy} onRemove={onRemove} onPublish={onPublish} />
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeDrag?.kind === "palette" ? (
          <div className="rounded-lg border border-primary/60 bg-primary/10 px-3 py-2 text-xs font-medium flex items-center gap-2 shadow-lg">
            {(() => {
              const Icon = BLOCK_ICONS[activeDrag.type];
              return <Icon className="h-4 w-4" />;
            })()}
            {BLOCK_LABELS[activeDrag.type]}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* Sortable + selectable wrapper around a preview block */
function PreviewBlockWrap({
  block, color, selected, onSelect, onRemove,
}: {
  block: CheckoutBlock;
  color: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 50 : "auto",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative rounded-lg cursor-pointer transition outline outline-2 outline-offset-2 ${
        selected ? "outline-primary" : "outline-transparent hover:outline-primary/40"
      }`}
    >
      <BlockRenderer block={block} color={color} />
      <div className="absolute -top-2 -right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{ touchAction: "none" }}
          className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center shadow cursor-grab active:cursor-grabbing"
          aria-label="Mover"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow"
          aria-label="Remover"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* Droppable canvas wrapper for the preview blocks area */
function PreviewBlocksDrop({
  blocks, color, selectedId, onSelect, onRemoveBlock, isDraggingPalette,
}: {
  blocks: CheckoutBlock[];
  color: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  isDraggingPalette: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_ID });
  const highlight = isDraggingPalette || isOver;
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg transition ${
        highlight ? "ring-2 ring-primary/60 bg-primary/5" : ""
      } ${blocks.length === 0 && isDraggingPalette ? "min-h-[120px] border-2 border-dashed border-primary/50 flex items-center justify-center text-xs text-primary" : ""}`}
    >
      {blocks.length === 0 ? (
        isDraggingPalette ? <span>Solte aqui para adicionar</span> : null
      ) : (
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {blocks.map((b) => (
              <PreviewBlockWrap
                key={b.id}
                block={b}
                color={color}
                selected={selectedId === b.id}
                onSelect={() => onSelect(b.id)}
                onRemove={() => onRemoveBlock(b.id)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

