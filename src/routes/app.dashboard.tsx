import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Zap,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/store";
import type { Order, Product } from "@/lib/types";
import { RevenueChart } from "@/components/RevenueChart";
import { SalesFunnel } from "@/components/SalesFunnel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EnableAdminPush } from "@/components/EnableAdminPush";
import {
  DashboardPeriodFilter,
  periodLabel,
  periodRange,
  type PeriodValue,
} from "@/components/DashboardPeriodFilter";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const uid = user?.id;
  const [period, setPeriod] = useState<PeriodValue>({ preset: "today" });

  const ordersQ = useQuery({
    queryKey: ["dash-orders", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,product_id,customer_name,amount,status,method,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        customer: r.customer_name ?? "—",
        productId: r.product_id ?? "",
        amount: Number(r.amount ?? 0),
        status: (r.status ?? "pendente") as Order["status"],
        method: (r.method ?? "pix") as Order["method"],
        date: r.created_at ?? new Date().toISOString(),
      }));
    },
  });

  const productsQ = useQuery({
    queryKey: ["dash-products", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase.from("products").select("*");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name ?? "—",
        description: r.description ?? "",
        price: Number(r.price ?? 0),
        image: r.image ?? "",
        type: (r.type ?? "digital") as Product["type"],
        deliveryUrl: r.delivery_url ?? "",
      }));
    },
  });

  const checkoutsQ = useQuery({
    queryKey: ["dash-checkouts", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkouts")
        .select("id,active,conversion");
      if (error) throw error;
      return (data ?? []) as { id: string; active: boolean | null; conversion: number | null }[];
    },
  });

  const allOrders = ordersQ.data ?? [];
  const products = productsQ.data ?? [];
  const checkouts = checkoutsQ.data ?? [];

  const { start, end } = useMemo(() => periodRange(period), [period]);
  const orders = useMemo(
    () =>
      allOrders.filter((o) => {
        const t = new Date(o.date).getTime();
        return t >= start.getTime() && t <= end.getTime();
      }),
    [allOrders, start, end],
  );
  const approved = orders.filter((o) => o.status === "aprovado");
  const revenue = approved.reduce((s, o) => s + o.amount, 0);
  const conv = checkouts.length
    ? (
        checkouts.reduce((s, c) => s + Number(c.conversion ?? 0), 0) /
        checkouts.length
      ).toFixed(1)
    : "0";
  const activeCheckouts = checkouts.filter((c) => c.active).length;

  const stats = [
    { label: "Faturamento", value: brl(revenue), icon: DollarSign, hint: `${approved.length} vendas aprovadas` },
    { label: "Vendas", value: approved.length, icon: ShoppingBag, hint: `${orders.length} pedidos no total` },
    { label: "Conversão média", value: `${conv}%`, icon: TrendingUp, hint: "Média dos checkouts" },
    { label: "Checkouts ativos", value: activeCheckouts, icon: Zap, hint: `${checkouts.length} no total` },
  ];

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const loading = ordersQ.isLoading || productsQ.isLoading || checkoutsQ.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral dos últimos dias</p>
        </div>
        <Link to="/app/checkouts">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Criar checkout
          </Button>
        </Link>
      </div>

      <EnableAdminPush />



      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-2xl border-border bg-card/60 hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {s.label}
              </CardTitle>
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ background: "var(--gradient-primary)" }}
              >
                <s.icon className="h-4 w-4 text-primary-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2 bg-card/60 border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Faturamento</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Últimos 7 dias</p>
            </div>
            <Badge variant="secondary" className="bg-primary/15 text-primary border-0">Diário</Badge>
          </CardHeader>
          <CardContent>
            <RevenueChart orders={orders} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card/60 border-border">
          <CardHeader>
            <CardTitle>Top produtos</CardTitle>
            <p className="text-xs text-muted-foreground">Mais vendidos no período</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {topProducts(orders, products).map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted overflow-hidden shrink-0">
                  {p.image && (
                    <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.count} vendas</div>
                </div>
                <span className="text-sm font-semibold tabular-nums">{brl(p.total)}</span>
              </div>
            ))}
            {!loading && orders.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl bg-card/60 border-border">
          <CardHeader>
            <CardTitle>Funil de vendas</CardTitle>
            <p className="text-xs text-muted-foreground">Jornada do visitante até a venda confirmada</p>
          </CardHeader>
          <CardContent>
            <SalesFunnel orders={orders} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card/60 border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Últimos pedidos</CardTitle>
            <Link to="/app/pedidos" className="text-sm text-primary flex items-center gap-1">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {orders.slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{o.customer}</div>
                    <div className="text-xs text-muted-foreground truncate">{productName(o.productId)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{brl(o.amount)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))}
              {!loading && orders.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">Sem pedidos ainda.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function topProducts(orders: Order[], products: Product[]) {
  const acc = new Map<string, { count: number; total: number }>();
  for (const o of orders) {
    if (o.status !== "aprovado") continue;
    const cur = acc.get(o.productId) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += o.amount;
    acc.set(o.productId, cur);
  }
  return products
    .map((p) => ({ ...p, ...(acc.get(p.id) ?? { count: 0, total: 0 }) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
}

function StatusBadge({ status }: { status: Order["status"] }) {
  const map: Record<Order["status"], string> = {
    aprovado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    pendente: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    recusado: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    reembolsado: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  };
  return (
    <Badge variant="secondary" className={`${map[status]} border-0 capitalize`}>
      {status}
    </Badge>
  );
}
