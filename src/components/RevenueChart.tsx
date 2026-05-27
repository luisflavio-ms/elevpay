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

export function RevenueChart({
  orders,
  start,
  end,
}: {
  orders: Order[];
  start?: Date;
  end?: Date;
}) {
  const { data, isHourly } = useMemo(() => {
    // Determina o intervalo. Se não vier, usa últimos 7 dias.
    const now = new Date();
    const endD = end ?? now;
    const startD =
      start ??
      (() => {
        const d = new Date(now);
        d.setDate(now.getDate() - 6);
        d.setHours(0, 0, 0, 0);
        return d;
      })();

    const sameDay =
      startD.getFullYear() === endD.getFullYear() &&
      startD.getMonth() === endD.getMonth() &&
      startD.getDate() === endD.getDate();

    if (sameDay) {
      // Buckets por hora (0..23)
      const buckets = Array.from({ length: 24 }, (_, h) => ({
        label: `${String(h).padStart(2, "0")}h`,
        value: 0,
        key: h,
      }));
      for (const o of orders) {
        if (o.status !== "aprovado") continue;
        const d = new Date(o.date);
        if (
          d.getFullYear() !== startD.getFullYear() ||
          d.getMonth() !== startD.getMonth() ||
          d.getDate() !== startD.getDate()
        )
          continue;
        buckets[d.getHours()].value += o.amount;
      }
      return { data: buckets, isHourly: true };
    }

    // Buckets por dia
    const days: { label: string; key: string; value: number }[] = [];
    const cursor = new Date(startD);
    cursor.setHours(0, 0, 0, 0);
    const endKey = new Date(endD);
    endKey.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= endKey.getTime()) {
      const key = cursor.toISOString().slice(0, 10);
      const label = `${String(cursor.getDate()).padStart(2, "0")}/${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      days.push({ key, label, value: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    const map = new Map(days.map((d) => [d.key, d]));
    for (const o of orders) {
      if (o.status !== "aprovado") continue;
      const k = new Date(o.date).toISOString().slice(0, 10);
      const b = map.get(k);
      if (b) b.value += o.amount;
    }
    return { data: days, isHourly: false };
  }, [orders, start, end]);

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
            interval={isHourly ? 2 : "preserveStartEnd"}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "oklch(0.7 0.02 285)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
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
