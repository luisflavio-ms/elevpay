import { useMemo } from "react";
import type { Order } from "@/lib/types";

type Stage = {
  label: string;
  description: string;
  value: number;
  pct: number; // 0-100 for visual width
};

export function SalesFunnel({ orders }: { orders: Order[] }) {
  const stages: Stage[] = useMemo(() => {
    const visitors = Math.max(120, orders.length * 25); // mock
    const startedCheckout = Math.round(visitors * 0.45);
    const created = orders.length;
    const paid = orders.filter((o) => o.status === "aprovado").length;
    const withBump = Math.round(paid * 0.32);

    const arr = [
      { label: "Visitantes", description: "Acessaram o checkout", value: visitors },
      { label: "Iniciaram checkout", description: "Preencheram pelo menos 1 campo", value: startedCheckout },
      { label: "Pagamentos criados", description: "Todos os pedidos gerados", value: created },
      { label: "Pagos", description: "Apenas com status aprovado", value: paid },
      { label: "Com order bump", description: "Pagos que aceitaram a oferta", value: withBump },
    ];
    const top = arr[0].value || 1;
    return arr.map((s, i) => ({
      ...s,
      pct: Math.max(18, Math.round((s.value / top) * 100) - i * 2),
    }));
  }, [orders]);

  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const nextPct = stages[i + 1]?.pct;
        return (
          <div key={s.label} className="flex flex-col items-center">
            <FunnelStage stage={s} index={i} total={stages.length} />
            {nextPct !== undefined && (
              <Connector fromPct={s.pct} toPct={nextPct} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FunnelStage({ stage, index, total }: { stage: Stage; index: number; total: number }) {
  const pct = stage.value && total > 1
    ? Math.round((stage.value / Math.max(stage.value, total)) * 100)
    : 0;
  const intensity = 0.85 - index * 0.12; // top brighter
  return (
    <div
      className="relative rounded-2xl border border-primary/30 bg-card overflow-hidden transition-all"
      style={{
        width: `${stage.pct}%`,
        minWidth: 280,
        background: `linear-gradient(135deg, oklch(0.58 0.24 295 / ${0.18 * intensity}), oklch(0.21 0.008 285)) `,
        boxShadow: `inset 0 0 0 1px oklch(0.58 0.24 295 / ${0.25 * intensity})`,
      }}
    >
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              {index + 1}
            </span>
            <h4 className="font-semibold text-sm">{stage.label}</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold tabular-nums">{stage.value}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {index === 0 ? "100% do topo" : `${pct ? "" : ""}`}
          </div>
        </div>
      </div>
      {/* progress bar at bottom */}
      <div className="h-1 w-full bg-primary/10">
        <div
          className="h-full"
          style={{
            width: `${stage.pct}%`,
            background: "var(--gradient-primary)",
          }}
        />
      </div>
    </div>
  );
}

function Connector({ fromPct, toPct }: { fromPct: number; toPct: number }) {
  // Draw a tapered SVG that visually narrows from one stage to the next
  return (
    <div
      className="relative -my-px"
      style={{ width: `${Math.max(fromPct, toPct)}%`, minWidth: 280, height: 18 }}
    >
      <svg viewBox="0 0 100 18" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="funnel-taper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.58 0.24 295 / 0.35)" />
            <stop offset="100%" stopColor="oklch(0.58 0.24 295 / 0.05)" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,0 100,0 ${50 + (toPct / fromPct) * 50},18 ${50 - (toPct / fromPct) * 50},18`}
          fill="url(#funnel-taper)"
        />
      </svg>
    </div>
  );
}
