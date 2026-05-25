import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  DollarSign,
  XCircle,
  RotateCcw,
  Filter,
  Download,
  Calendar,
  Search,
  Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/vendas")({
  component: VendasPage,
});

type Period = "hoje" | "7d" | "30d" | "tudo";
type OrderStatus = "aprovado" | "pendente" | "recusado" | "reembolsado";
type PaymentMethod = "pix" | "cartao" | "boleto";

type OrderRow = {
  id: string;
  product_id: string | null;
  customer_name: string;
  customer_email: string | null;
  amount: number;
  status: OrderStatus;
  method: PaymentMethod;
  created_at: string;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function VendasPage() {
  const [period, setPeriod] = useState<Period>("tudo");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [method, setMethod] = useState<string>("todos");
  const [productId, setProductId] = useState<string>("todos");
  const [open, setOpen] = useState<OrderRow | null>(null);

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,product_id,customer_name,customer_email,amount,status,method,created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const productsQ = useQuery({
    queryKey: ["products", "names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const products = productsQ.data ?? [];
  const productName = (id: string | null) =>
    (id && products.find((p) => p.id === id)?.name) || "—";

  const filtered = useMemo(() => {
    const orders = ordersQ.data ?? [];
    const now = Date.now();
    const cutoff =
      period === "hoje"
        ? now - 1 * 24 * 3600 * 1000
        : period === "7d"
          ? now - 7 * 24 * 3600 * 1000
          : period === "30d"
            ? now - 30 * 24 * 3600 * 1000
            : 0;
    return orders.filter((o) => {
      if (cutoff && new Date(o.created_at).getTime() < cutoff) return false;
      if (status !== "todos" && o.status !== status) return false;
      if (method !== "todos" && o.method !== method) return false;
      if (productId !== "todos" && o.product_id !== productId) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          o.id.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          (o.customer_email ?? "").toLowerCase().includes(q) ||
          productName(o.product_id).toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [ordersQ.data, period, status, method, productId, search, products]);

  const stats = useMemo(() => {
    const aprovadas = filtered.filter((o) => o.status === "aprovado");
    const liquido = aprovadas.reduce((s, o) => s + Number(o.amount), 0);
    return {
      found: filtered.length,
      liquido,
      canceladas: filtered.filter((o) => o.status === "recusado").length,
      reembolsadas: filtered.filter((o) => o.status === "reembolsado").length,
    };
  }, [filtered]);

  const clear = () => {
    setPeriod("tudo");
    setSearch("");
    setStatus("todos");
    setMethod("todos");
    setProductId("todos");
  };

  const exportCsv = () => {
    const rows = [
      ["Data", "Pedido", "Cliente", "Produto", "Status", "Valor", "Método"],
      ...filtered.map((o) => [
        new Date(o.created_at).toLocaleString("pt-BR"),
        o.id,
        o.customer_name,
        productName(o.product_id),
        o.status,
        Number(o.amount).toString().replace(".", ","),
        o.method,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe suas vendas e analise performance
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Filter className="h-4 w-4" /> Filtros ativos:
          <ActivePill label={periodLabel(period)} />
          {status !== "todos" && <ActivePill label={status} />}
          {method !== "todos" && <ActivePill label={method} />}
          {productId !== "todos" && <ActivePill label={productName(productId)} />}
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Vendas encontradas"
          value={stats.found.toString()}
          icon={ShoppingCart}
          tone="primary"
        />
        <StatCard
          label="Valor líquido"
          value={brl(stats.liquido)}
          icon={DollarSign}
          tone="success"
          valueClassName="text-emerald-400"
        />
        <StatCard
          label="Canceladas"
          value={stats.canceladas.toString()}
          icon={XCircle}
          tone="danger"
          valueClassName="text-rose-400"
        />
        <StatCard
          label="Reembolsadas"
          value={stats.reembolsadas.toString()}
          icon={RotateCcw}
          tone="warning"
          valueClassName="text-amber-400"
        />
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="w-full">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="tudo">Todo período</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido, e-mail ou nome"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="recusado">Recusado</SelectItem>
                  <SelectItem value="reembolsado">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos métodos</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos produtos</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-12 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={clear}>
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl overflow-hidden">
        <div className="hidden md:grid grid-cols-12 px-6 py-3 border-b text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <div className="col-span-2">Data</div>
          <div className="col-span-3">Pedido / Produto</div>
          <div className="col-span-2">Cliente</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">Valor</div>
          <div className="col-span-1">Método</div>
          <div className="col-span-1 text-right">Ações</div>
        </div>

        {ordersQ.isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Carregando vendas…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma venda encontrada.
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((o) => (
              <div
                key={o.id}
                className="md:grid md:grid-cols-12 px-6 py-4 hover:bg-muted/30 text-sm items-center"
              >
                <div className="col-span-2 text-muted-foreground">
                  <div>{new Date(o.created_at).toLocaleDateString("pt-BR")}</div>
                  <div className="text-xs">
                    {new Date(o.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="col-span-3">
                  <div className="font-mono text-xs text-muted-foreground">
                    #{o.id.slice(-8)}
                  </div>
                  <div className="font-medium truncate">
                    {productName(o.product_id)}
                  </div>
                </div>
                <div className="col-span-2 truncate">{o.customer_name}</div>
                <div className="col-span-2">
                  <StatusBadge status={o.status} />
                </div>
                <div className="col-span-1 font-semibold">
                  {brl(Number(o.amount))}
                </div>
                <div className="col-span-1 capitalize text-muted-foreground">
                  {o.method}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(o)}
                    aria-label="Ver detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhe da venda</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-2 text-sm">
              <Row k="ID" v={open.id} />
              <Row k="Cliente" v={open.customer_name} />
              {open.customer_email && <Row k="Email" v={open.customer_email} />}
              <Row k="Produto" v={productName(open.product_id)} />
              <Row k="Valor" v={brl(Number(open.amount))} />
              <Row k="Método" v={open.method} />
              <Row k="Status" v={open.status} />
              <Row k="Data" v={new Date(open.created_at).toLocaleString("pt-BR")} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function periodLabel(p: Period) {
  return p === "hoje"
    ? "Hoje"
    : p === "7d"
      ? "Últimos 7 dias"
      : p === "30d"
        ? "Últimos 30 dias"
        : "Todo período";
}

function ActivePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/15 text-primary text-xs font-medium capitalize">
      {label}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b pb-1.5 gap-4">
      <span className="text-muted-foreground shrink-0">{k}</span>
      <span className="font-medium text-right break-all">{v}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = {
    aprovado: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    pendente: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    recusado: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
    reembolsado: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  };
  return (
    <Badge variant="secondary" className={`${map[status]} capitalize`}>
      {status}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  valueClassName,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "danger" | "warning";
  valueClassName?: string;
}) {
  const toneMap = {
    primary: "bg-primary/15 text-primary",
    success: "bg-emerald-500/15 text-emerald-400",
    danger: "bg-rose-500/15 text-rose-400",
    warning: "bg-amber-500/15 text-amber-400",
  };
  return (
    <Card className="rounded-2xl border-border/60 hover:border-primary/40 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div
              className={`mt-3 text-3xl font-bold tracking-tight ${valueClassName ?? ""}`}
            >
              {value}
            </div>
          </div>
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center ${toneMap[tone]}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
