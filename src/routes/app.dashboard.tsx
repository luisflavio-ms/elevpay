import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { brl, db, seedIfNeeded } from "@/lib/store";
import type { Order, Checkout, Product } from "@/lib/types";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    seedIfNeeded();
    setOrders(db.getOrders());
    setCheckouts(db.getCheckouts());
    setProducts(db.getProducts());
  }, []);

  const approved = orders.filter((o) => o.status === "aprovado");
  const revenue = approved.reduce((s, o) => s + o.amount, 0);
  const conv = checkouts.length
    ? (
        checkouts.reduce((s, c) => s + c.conversion, 0) / checkouts.length
      ).toFixed(1)
    : "0";
  const activeCheckouts = checkouts.filter((c) => c.active).length;

  const stats = [
    { label: "Faturamento", value: brl(revenue), icon: DollarSign, hint: "+12% vs mês anterior" },
    { label: "Vendas", value: approved.length, icon: ShoppingBag, hint: `${orders.length} pedidos no total` },
    { label: "Conversão média", value: `${conv}%`, icon: TrendingUp, hint: "Acima da média do mercado" },
    { label: "Checkouts ativos", value: activeCheckouts, icon: Zap, hint: `${checkouts.length} no total` },
  ];

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";

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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl">
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
            {orders.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">Sem pedidos ainda.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
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
