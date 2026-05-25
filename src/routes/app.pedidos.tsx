import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/app/pedidos")({
  component: PedidosPage,
});

type OrderStatus = "aprovado" | "pendente" | "recusado" | "reembolsado";

type OrderRow = {
  id: string;
  product_id: string | null;
  checkout_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_document: string | null;
  customer_phone: string | null;
  amount: number;
  status: OrderStatus;
  method: "pix" | "cartao" | "boleto";
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  external_id: string | null;
  created_at: string;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PedidosPage() {
  const [open, setOpen] = useState<OrderRow | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,product_id,checkout_id,customer_name,customer_email,customer_document,customer_phone,amount,status,method,utm_source,utm_medium,utm_campaign,external_id,created_at",
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

  const productName = (id: string | null) =>
    (id && productsQ.data?.find((p) => p.id === id)?.name) || "—";

  const filtered = useMemo(() => {
    const orders = ordersQ.data ?? [];
    const s = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!s) return true;
      return (
        o.customer_name.toLowerCase().includes(s) ||
        (o.customer_email ?? "").toLowerCase().includes(s) ||
        productName(o.product_id).toLowerCase().includes(s)
      );
    });
  }, [ordersQ.data, q, statusFilter, productsQ.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Histórico de vendas</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, email ou produto"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="recusado">Recusado</SelectItem>
            <SelectItem value="reembolsado">Reembolsado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {ordersQ.isLoading ? (
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Carregando pedidos…
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">Sem pedidos ainda</h3>
            <p className="text-sm text-muted-foreground">
              As vendas aparecerão aqui assim que chegarem.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 px-6 py-3 bg-muted/50 text-xs font-medium text-muted-foreground">
            <div className="col-span-3">Cliente</div>
            <div className="col-span-3">Produto</div>
            <div className="col-span-2">Método</div>
            <div className="col-span-2">Valor</div>
            <div className="col-span-2">Status</div>
          </div>
          <div className="divide-y">
            {filtered.map((o) => (
              <button
                key={o.id}
                onClick={() => setOpen(o)}
                className="w-full text-left md:grid md:grid-cols-12 px-6 py-3 hover:bg-muted/30 text-sm"
              >
                <div className="col-span-3">
                  <div className="font-medium">{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="col-span-3 text-muted-foreground truncate">
                  {productName(o.product_id)}
                </div>
                <div className="col-span-2 capitalize">{o.method}</div>
                <div className="col-span-2 font-semibold">{brl(Number(o.amount))}</div>
                <div className="col-span-2">
                  <StatusBadge status={o.status} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhe do pedido</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-2 text-sm">
              <Row k="ID" v={open.id} />
              <Row k="Cliente" v={open.customer_name} />
              {open.customer_email && <Row k="Email" v={open.customer_email} />}
              {open.customer_phone && <Row k="Telefone" v={open.customer_phone} />}
              {open.customer_document && (
                <Row k="Documento" v={open.customer_document} />
              )}
              <Row k="Produto" v={productName(open.product_id)} />
              <Row k="Valor" v={brl(Number(open.amount))} />
              <Row k="Método" v={open.method} />
              <Row k="Status" v={open.status} />
              {open.external_id && <Row k="ID externo" v={open.external_id} />}
              {open.utm_source && <Row k="UTM source" v={open.utm_source} />}
              {open.utm_campaign && <Row k="UTM campaign" v={open.utm_campaign} />}
              <Row k="Data" v={new Date(open.created_at).toLocaleString("pt-BR")} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
    aprovado: "bg-emerald-100 text-emerald-700",
    pendente: "bg-amber-100 text-amber-700",
    recusado: "bg-red-100 text-red-700",
    reembolsado: "bg-slate-200 text-slate-700",
  };
  return (
    <Badge variant="secondary" className={`${map[status]} border-0 capitalize`}>
      {status}
    </Badge>
  );
}
