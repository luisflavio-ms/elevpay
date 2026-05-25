import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl, db, seedIfNeeded } from "@/lib/store";
import type { Order, Product } from "@/lib/types";

export const Route = createFileRoute("/app/pedidos")({
  component: PedidosPage,
});

function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState<Order | null>(null);

  useEffect(() => {
    seedIfNeeded();
    setOrders(db.getOrders());
    setProducts(db.getProducts());
  }, []);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Histórico de vendas</p>
      </div>

      {orders.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">Sem pedidos ainda</h3>
            <p className="text-sm text-muted-foreground">As vendas aparecerão aqui.</p>
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
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => setOpen(o)}
                className="w-full text-left md:grid md:grid-cols-12 px-6 py-3 hover:bg-muted/30 text-sm"
              >
                <div className="col-span-3">
                  <div className="font-medium">{o.customer}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.date).toLocaleDateString("pt-BR")}</div>
                </div>
                <div className="col-span-3 text-muted-foreground truncate">{productName(o.productId)}</div>
                <div className="col-span-2 capitalize">{o.method}</div>
                <div className="col-span-2 font-semibold">{brl(o.amount)}</div>
                <div className="col-span-2"><StatusBadge status={o.status} /></div>
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
              <Row k="Cliente" v={open.customer} />
              <Row k="Produto" v={productName(open.productId)} />
              <Row k="Valor" v={brl(open.amount)} />
              <Row k="Método" v={open.method} />
              <Row k="Status" v={open.status} />
              <Row k="Data" v={new Date(open.date).toLocaleString("pt-BR")} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b pb-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium capitalize">{v}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Order["status"] }) {
  const map: Record<Order["status"], string> = {
    aprovado: "bg-emerald-100 text-emerald-700",
    pendente: "bg-amber-100 text-amber-700",
    recusado: "bg-red-100 text-red-700",
    reembolsado: "bg-slate-200 text-slate-700",
  };
  return <Badge variant="secondary" className={`${map[status]} border-0 capitalize`}>{status}</Badge>;
}
