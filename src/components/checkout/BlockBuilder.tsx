import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useDraggable,
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
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  CheckoutBlock,
  CheckoutBlockType,
  PurchaseNotification,
} from "@/lib/types";
import { BLOCK_ICONS, BLOCK_LABELS, createBlock } from "./blockDefaults";

interface Props {
  blocks: CheckoutBlock[];
  onChange: (b: CheckoutBlock[]) => void;
}

export const TYPES: CheckoutBlockType[] = ["image", "text", "html", "timer", "guarantee", "notifications", "secureSeal"];

export const CANVAS_ID = "checkout-canvas";

export function Palette({ onAdd, orientation = "grid" }: { onAdd: (t: CheckoutBlockType) => void; orientation?: "grid" | "stack" }) {
  return (
    <div className={orientation === "stack" ? "flex flex-col gap-1.5" : "grid grid-cols-2 gap-1.5"}>
      {TYPES.map((t) => (
        <PaletteItem key={t} type={t} onClick={() => onAdd(t)} />
      ))}
    </div>
  );
}

export function BlockBuilder({ blocks, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeDrag, setActiveDrag] = useState<
    | { kind: "palette"; type: CheckoutBlockType }
    | { kind: "sort"; id: string }
    | null
  >(null);

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

    // From palette → drop into canvas / on a block
    if (data?.source === "palette" && data.type) {
      const newBlock = createBlock(data.type);
      if (over.id === CANVAS_ID) {
        onChange([...blocks, newBlock]);
        return;
      }
      const idx = blocks.findIndex((b) => b.id === over.id);
      if (idx < 0) {
        onChange([...blocks, newBlock]);
      } else {
        const next = [...blocks];
        next.splice(idx, 0, newBlock);
        onChange(next);
      }
      return;
    }

    // Sort existing
    if (active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onChange(arrayMove(blocks, oldIdx, newIdx));
  };

  const update = (id: string, patch: Partial<CheckoutBlock>) =>
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as CheckoutBlock) : b)));

  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));
  const add = (t: CheckoutBlockType) => onChange([...blocks, createBlock(t)]);
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    onChange(arrayMove(blocks, i, j));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="grid grid-cols-[160px_1fr] gap-3">
        {/* PALETTE (LEFT) */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-2 h-fit sticky top-2">
          <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">
            Arraste para o canvas
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {TYPES.map((t) => (
              <PaletteItem key={t} type={t} onClick={() => add(t)} />
            ))}
          </div>
        </div>

        {/* CANVAS (MIDDLE) */}
        <CanvasDroppable hasBlocks={blocks.length > 0} isOver={activeDrag?.kind === "palette"}>
          {blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground min-h-[180px] flex flex-col items-center justify-center">
              <Plus className="h-5 w-5 mb-2 opacity-60" />
              Arraste blocos da esquerda<br />
              ou clique para adicionar.
            </div>
          ) : (
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {blocks.map((b, i) => (
                  <SortableItem
                    key={b.id}
                    block={b}
                    onUpdate={(patch) => update(b.id, patch)}
                    onRemove={() => remove(b.id)}
                    onMoveUp={() => move(b.id, -1)}
                    onMoveDown={() => move(b.id, 1)}
                    isFirst={i === 0}
                    isLast={i === blocks.length - 1}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </CanvasDroppable>
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

export function PaletteItem({ type, onClick }: { type: CheckoutBlockType; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", type },
  });
  const Icon = BLOCK_ICONS[type];
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      style={{ touchAction: "none", opacity: isDragging ? 0.4 : 1 }}
      className="group flex flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-background/40 hover:border-primary/60 hover:bg-primary/10 px-1 py-2.5 text-[10px] font-medium text-foreground/80 transition cursor-grab active:cursor-grabbing"
    >
      <Icon className="h-4 w-4 text-primary/80 group-hover:text-primary" />
      {BLOCK_LABELS[type]}
    </button>
  );
}

function CanvasDroppable({
  children, hasBlocks, isOver,
}: { children: React.ReactNode; hasBlocks: boolean; isOver: boolean }) {
  const { setNodeRef, isOver: over } = useDroppable({ id: CANVAS_ID });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl transition ${
        isOver || over
          ? "ring-2 ring-primary/60 bg-primary/5"
          : ""
      } ${hasBlocks ? "p-1" : ""}`}
    >
      {children}
    </div>
  );
}

function SortableItem({
  block, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  block: CheckoutBlock;
  onUpdate: (patch: Partial<CheckoutBlock>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: block.id });
  const [open, setOpen] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
    position: "relative" as const,
  };
  const Icon = BLOCK_ICONS[block.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          style={{ touchAction: "none" }}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Icon className="h-4 w-4 text-primary/80" />
        <span className="text-sm font-medium flex-1 truncate">{BLOCK_LABELS[block.type]}</span>
        <button onClick={onMoveUp} disabled={isFirst} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ChevronUp className="h-4 w-4" />
        </button>
        <button onClick={onMoveDown} disabled={isLast} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ChevronDown className="h-4 w-4" />
        </button>
        <button onClick={() => setOpen((v) => !v)} className="text-xs text-primary px-2 py-1 rounded hover:bg-primary/10">
          {open ? "Fechar" : "Editar"}
        </button>
        <button onClick={onRemove} className="p-1 text-destructive/80 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-2">
          <BlockEditor block={block} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

export function BlockEditor({
  block, onUpdate,
}: { block: CheckoutBlock; onUpdate: (patch: Partial<CheckoutBlock>) => void }) {
  if (block.type === "image") {
    return (
      <>
        <F label="URL da imagem">
          <Input value={block.src} onChange={(e) => onUpdate({ src: e.target.value })} />
        </F>
        <F label="Texto alternativo">
          <Input value={block.alt} onChange={(e) => onUpdate({ alt: e.target.value })} />
        </F>
        <TogRow label="Cantos arredondados" checked={block.rounded} onChange={(v) => onUpdate({ rounded: v })} />
      </>
    );
  }
  if (block.type === "text") {
    return (
      <>
        <F label="Conteúdo">
          <Textarea rows={3} value={block.content} onChange={(e) => onUpdate({ content: e.target.value })} />
        </F>
        <div className="grid grid-cols-2 gap-2">
          <F label="Tamanho">
            <Select value={block.size} onValueChange={(v) => onUpdate({ size: v as typeof block.size })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Pequeno</SelectItem>
                <SelectItem value="md">Médio</SelectItem>
                <SelectItem value="lg">Grande</SelectItem>
                <SelectItem value="xl">Título</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="Alinhamento">
            <Select value={block.align} onValueChange={(v) => onUpdate({ align: v as typeof block.align })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="right">Direita</SelectItem>
              </SelectContent>
            </Select>
          </F>
        </div>
        <TogRow label="Negrito" checked={block.bold} onChange={(v) => onUpdate({ bold: v })} />
      </>
    );
  }
  if (block.type === "html") {
    return (
      <F label="Código HTML">
        <Textarea
          rows={6}
          className="font-mono text-xs"
          value={block.code}
          onChange={(e) => onUpdate({ code: e.target.value })}
        />
      </F>
    );
  }
  if (block.type === "timer") {
    return (
      <>
        <F label="Rótulo">
          <Input value={block.label} onChange={(e) => onUpdate({ label: e.target.value })} />
        </F>
        <F label="Minutos">
          <Input
            type="number" min={1}
            value={block.minutes}
            onChange={(e) => onUpdate({ minutes: Math.max(1, Number(e.target.value) || 1) })}
          />
        </F>
      </>
    );
  }
  if (block.type === "guarantee") {
    return (
      <>
        <F label="Título">
          <Input value={block.title} onChange={(e) => onUpdate({ title: e.target.value })} />
        </F>
        <F label="Dias de garantia">
          <Input
            type="number" min={1}
            value={block.days}
            onChange={(e) => onUpdate({ days: Math.max(1, Number(e.target.value) || 1) })}
          />
        </F>
        <F label="Descrição">
          <Textarea rows={2} value={block.text} onChange={(e) => onUpdate({ text: e.target.value })} />
        </F>
      </>
    );
  }
  if (block.type === "notifications") {
    const items = block.items;
    const setItem = (i: number, k: keyof PurchaseNotification, v: string) => {
      const next = items.map((it, x) => (x === i ? { ...it, [k]: v } : it));
      onUpdate({ items: next });
    };
    const rm = (i: number) => onUpdate({ items: items.filter((_, x) => x !== i) });
    const add = () =>
      onUpdate({
        items: [
          ...items,
          { name: "Cliente", product: "acabou de comprar", city: "Brasil", ago: "agora" },
        ],
      });
    return (
      <>
        <F label="Atraso inicial (segundos)">
          <Input
            type="number" min={0}
            value={block.delaySec ?? 6}
            onChange={(e) => onUpdate({ delaySec: Math.max(0, Number(e.target.value) || 0) })}
          />
        </F>
        <F label="Intervalo (segundos)">
          <Input
            type="number" min={2}
            value={block.intervalSec}
            onChange={(e) => onUpdate({ intervalSec: Math.max(2, Number(e.target.value) || 2) })}
          />
        </F>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-border/50 p-2 space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Input placeholder="Nome" value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} />
                <Input placeholder="Cidade" value={it.city} onChange={(e) => setItem(i, "city", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input placeholder="Ação" value={it.product} onChange={(e) => setItem(i, "product", e.target.value)} />
                <Input placeholder="Tempo" value={it.ago} onChange={(e) => setItem(i, "ago", e.target.value)} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => rm(i)}>
                <Trash2 className="h-3 w-3 mr-1" /> Remover
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Notificação
          </Button>
        </div>
      </>
    );
  }
  if (block.type === "secureSeal") {
    return (
      <F label="Texto do selo">
        <Input value={block.text} onChange={(e) => onUpdate({ text: e.target.value })} />
      </F>
    );
  }
  return null;
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function TogRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
