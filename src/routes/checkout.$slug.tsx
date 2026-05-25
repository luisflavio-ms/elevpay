import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Checkout, Product, OrderBump, PaymentMethod } from "@/lib/types";
import { brl } from "@/lib/store";
import { BlockRenderer } from "@/components/checkout/BlockRenderer";
import { supabase } from "@/integrations/supabase/client";
import { rowToCheckout, type CheckoutRow } from "@/lib/checkout-mapper";
import { createPixPayment, checkOrderStatus, simulatePixPayment } from "@/lib/abacate.functions";
import { subscribePush } from "@/lib/push.functions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push-config";


export const Route = createFileRoute("/checkout/$slug")({
  component: PublicCheckout,
});

/**
 * Public checkout — busca diretamente do Supabase (RLS permite anon
 * quando o checkout está active = true e o produto/bump referenciado).
 */
function PublicCheckout() {
  const { slug } = Route.useParams();
  const [data, setData] = useState<{ c: Checkout; p?: Product; b?: OrderBump } | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [bumpOn, setBumpOn] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", cpf: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [pix, setPix] = useState<{ orderId: string; qr: string; copy: string; amount: number } | null>(null);
  const [paid, setPaid] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const createPix = useServerFn(createPixPayment);
  const checkStatus = useServerFn(checkOrderStatus);
  const simulatePix = useServerFn(simulatePixPayment);
  const subscribePushFn = useServerFn(subscribePush);

  const enablePushForOrder = async (orderId: string) => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPayError("Seu navegador não suporta notificações push");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const json = sub.toJSON();
      await subscribePushFn({
        data: {
          orderId,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent.slice(0, 500),
        },
      });
    } catch (err) {
      setPayError((err as Error).message);
    }
  };


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: ckRow } = await supabase
          .from("checkouts")
          .select("*")
          .eq("slug", slug)
          .eq("active", true)
          .maybeSingle();
        if (!ckRow) {
          if (!cancelled) setLoading(false);
          return;
        }
        const c = rowToCheckout(ckRow as unknown as CheckoutRow);

        const [{ data: pRow }, { data: bRow }] = await Promise.all([
          c.productId
            ? supabase
                .from("products")
                .select("id,name,description,price,image,type,delivery_url")
                .eq("id", c.productId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          c.orderBumpId
            ? supabase
                .from("order_bumps")
                .select("id,title,description,price")
                .eq("id", c.orderBumpId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const p: Product | undefined = pRow
          ? {
              id: pRow.id as string,
              name: pRow.name as string,
              description: (pRow.description as string) ?? "",
              price: Number(pRow.price),
              image: (pRow.image as string) ?? "",
              type: pRow.type as Product["type"],
              deliveryUrl: (pRow.delivery_url as string) ?? "",
            }
          : undefined;

        const b: OrderBump | undefined = bRow
          ? {
              id: bRow.id as string,
              title: bRow.title as string,
              description: (bRow.description as string) ?? "",
              price: Number(bRow.price),
            }
          : undefined;

        if (cancelled) return;
        setData({ c, p, b });
        const first: PaymentMethod = c.paymentMethods.pix
          ? "pix"
          : c.paymentMethods.card
            ? "cartao"
            : "boleto";
        setMethod(first);
        if (c.scarcityTimerMinutes > 0) setSecondsLeft(c.scarcityTimerMinutes * 60);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const i = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(i);
  }, [secondsLeft]);

  // Polling do status do pedido PIX (precisa ficar antes dos early returns)
  useEffect(() => {
    if (!pix || paid) return;
    const interval = setInterval(async () => {
      try {
        const { status } = await checkStatus({ data: { orderId: pix.orderId } });
        if (status === "aprovado") {
          setPaid(true);
          clearInterval(interval);
        }
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [pix, paid, checkStatus]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 16 }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={skeleton(180)} />
          <div style={{ ...skeleton(24), marginTop: 16, width: "80%" }} />
          <div style={{ ...skeleton(20), marginTop: 8, width: "60%" }} />
          <div style={{ ...skeleton(180), marginTop: 16 }} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Checkout não encontrado</h1>
          <p style={{ color: "#64748b" }}>Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const { c, p, b } = data;
  const total = (p?.price ?? 0) + (bumpOn && b ? b.price : 0);
  const color = c.primaryColor;

  const maskPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  const maskCpf = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };
  const isValidCpf = (v: string) => {
    const c = v.replace(/\D/g, "");
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
    let r = (s * 10) % 11; if (r === 10) r = 0;
    if (r !== parseInt(c[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
    r = (s * 10) % 11; if (r === 10) r = 0;
    return r === parseInt(c[10]);
  };
  const isValidPhone = (v: string) => {
    const d = v.replace(/\D/g, "");
    return d.length === 10 || d.length === 11;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.cpf || !form.whatsapp) return;
    if (!isValidCpf(form.cpf)) { setPayError("CPF inválido"); return; }
    if (!isValidPhone(form.whatsapp)) { setPayError("WhatsApp inválido"); return; }

    setSubmitting(true);
    setPayError(null);
    try {
      if (method === "pix") {
        const result = await createPix({
          data: {
            slug,
            customer: {
              name: form.name,
              email: form.email,
              cpf: form.cpf,
              phone: form.whatsapp,
            },
            bumpOn,
          },
        });
        setPix({
          orderId: result.orderId,
          qr: result.qrCodeBase64,
          copy: result.copyPaste,
          amount: result.amount,
        });
        setDone(true);
      } else {
        // cartão/boleto: placeholder — apenas PIX está integrado
        setDone(true);
      }
    } catch (err) {
      setPayError((err as Error).message ?? "Erro ao gerar pagamento");
    } finally {
      setSubmitting(false);
    }
  };





  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 16 }}>
        {secondsLeft > 0 && (
          <div style={{ background: color, color: "#fff", padding: "10px 14px", borderRadius: 10, textAlign: "center", fontSize: 13, marginBottom: 12 }}>
            ⏳ Oferta expira em <b>{mm}:{ss}</b>
          </div>
        )}
        {c.urgencyMessage && (
          <div style={{ background: "#fef3c7", color: "#92400e", padding: "8px 12px", borderRadius: 10, fontSize: 13, marginBottom: 12, textAlign: "center" }}>
            {c.urgencyMessage}
          </div>
        )}

        {(c.blocks ?? []).length > 0 && (
          <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
            {(c.blocks ?? []).map((b) => (
              <BlockRenderer key={b.id} block={b} color={color} />
            ))}
          </div>
        )}


        {c.image && (
          <img
            src={c.image}
            alt=""
            loading="lazy"
            style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 12, marginBottom: 12 }}
          />
        )}

        <h1 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>{c.headline}</h1>
        {c.subheadline && <p style={{ color: "#475569", marginTop: 6 }}>{c.subheadline}</p>}

        {p && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>{p.name}</span>
            <span style={{ fontSize: 22, fontWeight: 800, color }}>{brl(p.price)}</span>
          </div>
        )}

        {c.benefits.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "14px 0", fontSize: 14 }}>
            {c.benefits.filter(Boolean).map((bn, i) => (
              <li key={i} style={{ padding: "4px 0" }}>
                <span style={{ color, marginRight: 8 }}>✓</span>{bn}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginTop: 8 }}>
          <h3 style={{ fontSize: 14, margin: "0 0 10px", fontWeight: 600 }}>Seus dados</h3>
          <Input placeholder="Nome completo" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Input placeholder="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Input placeholder="WhatsApp" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: maskPhone(v) })} />
          <Input placeholder="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: maskCpf(v) })} />


          <h3 style={{ fontSize: 14, margin: "14px 0 8px", fontWeight: 600 }}>Pagamento</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {c.paymentMethods.pix && <PayBtn label="Pix" active={method === "pix"} color={color} onClick={() => setMethod("pix")} />}
            {c.paymentMethods.card && <PayBtn label="Cartão" active={method === "cartao"} color={color} onClick={() => setMethod("cartao")} />}
            {c.paymentMethods.boleto && <PayBtn label="Boleto" active={method === "boleto"} color={color} onClick={() => setMethod("boleto")} />}
          </div>

          {method === "cartao" && (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <Input placeholder="Número do cartão" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Input placeholder="Validade (MM/AA)" />
                <Input placeholder="CVV" />
              </div>
              <Input placeholder="Nome no cartão" />
            </div>
          )}

          {b && (
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, padding: 12, border: `2px dashed ${color}`, borderRadius: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={bumpOn} onChange={(e) => setBumpOn(e.target.checked)} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 11, color, fontWeight: 700 }}>OFERTA ESPECIAL</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: "#475569" }}>{b.description}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>+ {brl(b.price)}</div>
              </div>
            </label>
          )}

          <div style={{ marginTop: 14, padding: 12, background: "#f1f5f9", borderRadius: 10, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total</span><span>{brl(total)}</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 12, width: "100%", padding: "14px 16px", background: color,
              color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700,
              cursor: "pointer", opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Processando..." : c.buttonText}
          </button>

          {c.secureSeal && (
            <p style={{ textAlign: "center", fontSize: 12, color: "#64748b", marginTop: 10 }}>
              🔒 Compra 100% segura • SSL criptografado
            </p>
          )}
          {c.guarantee && (
            <p style={{ textAlign: "center", fontSize: 12, color: "#475569", marginTop: 2 }}>
              🛡️ {c.guarantee}
            </p>
          )}
        </form>

        {c.testimonials.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8, fontWeight: 600 }}>O que dizem</h3>
            {c.testimonials.map((t, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <p style={{ fontSize: 13, margin: 0 }}>"{t.text}"</p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 4, marginBottom: 0 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        )}

        <footer style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 20, paddingBottom: 20 }}>
          Processado por <b>ElevPay</b>
        </footer>
      </div>

      {payError && (
        <div style={{ position: "fixed", bottom: 16, left: 16, right: 16, background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, fontSize: 13, textAlign: "center", maxWidth: 528, margin: "0 auto" }}>
          {payError}
        </div>
      )}
      {done && (
        <SuccessModal
          method={method}
          amount={total}
          onClose={() => setDone(false)}
          redirect={c.redirectUrl}
          pix={pix}
          paid={paid}
          onSimulate={async () => {
            if (!pix) return;
            try {
              await simulatePix({ data: { orderId: pix.orderId } });
            } catch (err) {
              setPayError((err as Error).message);
            }
          }}
          onEnablePush={async () => {
            if (!pix) return;
            await enablePushForOrder(pix.orderId);
          }}
        />
      )}

    </div>
  );
}

function Input(props: {
  placeholder: string;
  type?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <input
      type={props.type || "text"}
      placeholder={props.placeholder}
      value={props.value}
      onChange={(e) => props.onChange?.(e.target.value)}
      style={{
        width: "100%", padding: "11px 12px", border: "1px solid #cbd5e1",
        borderRadius: 8, fontSize: 14, marginBottom: 8, outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}

function PayBtn({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
        border: active ? `2px solid ${color}` : "1px solid #cbd5e1",
        background: active ? color + "10" : "#fff",
        color: active ? color : "#0f172a",
      }}
    >
      {label}
    </button>
  );
}

function skeleton(h: number): React.CSSProperties {
  return {
    height: h, background: "linear-gradient(90deg, #e2e8f0, #f1f5f9, #e2e8f0)",
    backgroundSize: "200% 100%", borderRadius: 10, animation: "elev-pulse 1.2s linear infinite",
  };
}

function SuccessModal({
  method,
  amount,
  onClose,
  redirect,
  pix,
  paid,
  onSimulate,
  onEnablePush,
}: {
  method: PaymentMethod;
  amount: number;
  onClose: () => void;
  redirect: string;
  pix: { orderId: string; qr: string; copy: string; amount: number } | null;
  paid: boolean;
  onSimulate: () => void;
  onEnablePush: () => void;
}) {

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "grid", placeItems: "center", padding: 16, zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%" }}
      >
        {method === "pix" && pix && !paid && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pague com Pix</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
              Escaneie o QR Code ou copie o código abaixo. Aguardando confirmação...
            </p>
            <div style={{ width: 220, height: 220, margin: "16px auto", background: "#fff", padding: 8, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <img
                src={pix.qr.startsWith("data:") ? pix.qr : `data:image/png;base64,${pix.qr}`}
                alt="QR Code Pix"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
            <div style={{ background: "#f1f5f9", borderRadius: 8, padding: 10, fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
              {pix.copy}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(pix.copy)}
              style={{ width: "100%", marginTop: 10, padding: 12, background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
            >
              Copiar código Pix
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "#64748b", marginTop: 8 }}>
              Valor: <b>{brl(pix.amount)}</b>
            </p>
            <button
              type="button"
              onClick={onEnablePush}
              style={{ width: "100%", marginTop: 10, padding: 12, background: "#ede9fe", color: "#5b21b6", border: "1px solid #c4b5fd", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              🔔 Receber notificação quando aprovar
            </button>
            <button
              type="button"
              onClick={onSimulate}
              style={{ width: "100%", marginTop: 10, padding: 10, background: "#fef3c7", color: "#92400e", border: "1px dashed #f59e0b", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              🧪 Simular pagamento (modo teste)
            </button>
          </>
        )}

        {method === "pix" && paid && (
          <>
            <div style={{ fontSize: 48, textAlign: "center" }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, textAlign: "center", margin: 0 }}>Pagamento confirmado!</h2>
            <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginTop: 6 }}>
              Recebemos seu Pix de <b>{brl(amount)}</b>.
            </p>
          </>
        )}
        {method === "boleto" && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Boleto gerado</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
              Seu boleto vence em 3 dias úteis. Pague em qualquer banco ou app.
            </p>
            <div style={{ background: "#f1f5f9", borderRadius: 8, padding: 12, marginTop: 14, fontFamily: "monospace", fontSize: 12 }}>
              23793.38128 60082.111111 11111.111111 1 99990000{Math.floor(amount * 100)}
            </div>
            <button style={{ width: "100%", marginTop: 10, padding: 12, background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
              Baixar boleto
            </button>
          </>
        )}
        {method === "cartao" && (
          <>
            <div style={{ fontSize: 48, textAlign: "center" }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, textAlign: "center", margin: 0 }}>Pagamento aprovado!</h2>
            <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginTop: 6 }}>
              Valor: <b>{brl(amount)}</b>
            </p>
            <p style={{ textAlign: "center", fontSize: 13, color: "#475569", marginTop: 10 }}>
              Você receberá um e-mail com os próximos passos.
            </p>
          </>
        )}
        <button
          onClick={onClose}
          style={{ width: "100%", marginTop: 14, padding: 12, background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer" }}
        >
          {redirect ? "Ir para próxima etapa" : "Fechar"}
        </button>
      </div>
      <style>{`@keyframes elev-pulse { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}
