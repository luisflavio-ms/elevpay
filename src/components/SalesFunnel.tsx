import { useMemo } from "react";
import type { Order } from "@/lib/types";

type Stage = {
  label: string;
  description: string;
  value: number;
};

export function SalesFunnel({ orders }: { orders: Order[] }) {
  const stages: Stage[] = useMemo(() => {
    const total = orders.length;
    const pendentes = orders.filter((o) => o.status === "pendente").length;
    const aprovados = orders.filter((o) => o.status === "aprovado").length;
    const recusados = orders.filter((o) => o.status === "recusado").length;
    const reembolsados = orders.filter((o) => o.status === "reembolsado").length;

    return [
      { label: "Pedidos criados", description: "Total de pedidos gerados", value: total },
      { label: "Pendentes", description: "Aguardando pagamento", value: pendentes },
      { label: "Aprovados", description: "Pagamentos confirmados", value: aprovados },
      { label: "Recusados", description: "Pagamentos não autorizados", value: recusados },
      { label: "Reembolsados", description: "Estornos realizados", value: reembolsados },
    ];
  }, [orders]);

  const top = Math.max(stages[0]?.value ?? 0, 1);

  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      {stages.map((s, i) => {
        // Width tapers from 100% to 60% across stages
        const width = 100 - i * 10;
        const pct = Math.round((s.value / top) * 100);
        const intensity = 0.9 - i * 0.13;
        const isLast = i === stages.length - 1;
        return (
          <div key={s.label} className="flex flex-col items-center w-full">
            <div
              className="relative rounded-2xl border border-primary/30 bg-card overflow-hidden transition-all"
              style={{
                width: `${width}%`,
                minWidth: 240,
                maxWidth: "100%",
                background: `linear-gradient(135deg, oklch(0.58 0.24 295 / ${0.18 * intensity}), oklch(0.21 0.008 285))`,
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
                      {i + 1}
                    </span>
                    <h4 className="font-semibold text-sm truncate">{s.label}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {i === 0 ? "100% do topo" : `${pct}% do topo`}
                  </div>
                </div>
              </div>
              <div className="h-1 w-full bg-primary/10">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    background: "var(--gradient-primary)",
                  }}
                />
              </div>
            </div>
            {!isLast && (
              <div
                className="h-3 w-px"
                style={{
                  background:
                    "linear-gradient(to bottom, oklch(0.58 0.24 295 / 0.6), oklch(0.58 0.24 295 / 0.1))",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
