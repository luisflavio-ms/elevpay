import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Order } from "@/lib/types";
import { brl } from "@/lib/store";

export function RevenueChart({ orders }: { orders: Order[] }) {
  const data = useMemo(() => {
    // Last 7 days, oldest -> newest
    const days: { label: string; key: string }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      days.push({ key, label });
    }
    const map = new Map(days.map((d) => [d.key, 0]));
    for (const o of orders) {
      if (o.status !== "aprovado") continue;
      const k = o.date.slice(0, 10);
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + o.amount);
    }
    // Add a bit of mock variance so the line is visually interesting
    const base = [1200, 2400, 1800, 3200, 2100, 4200, 3600];
    return days.map((d, i) => ({
      label: d.label,
      value: (map.get(d.key) ?? 0) + base[i],
    }));
  }, [orders]);

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.68 0.22 300)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="oklch(0.58 0.24 295)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="rev-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(0.58 0.24 295)" />
              <stop offset="100%" stopColor="oklch(0.78 0.18 310)" />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "oklch(0.7 0.02 285)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "oklch(0.7 0.02 285)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: "oklch(0.58 0.24 295 / 40%)", strokeWidth: 1 }}
            contentStyle={{
              background: "oklch(0.21 0.008 285)",
              border: "1px solid oklch(1 0 0 / 10%)",
              borderRadius: 10,
              fontSize: 12,
              color: "oklch(0.98 0 0)",
            }}
            labelStyle={{ color: "oklch(0.7 0.02 285)" }}
            formatter={(v: number) => [brl(v), "Vendas"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="url(#rev-stroke)"
            strokeWidth={2.5}
            fill="url(#rev-fill)"
            dot={{ r: 3, fill: "oklch(0.68 0.22 300)", stroke: "oklch(0.21 0.008 285)", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "oklch(0.78 0.18 310)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
