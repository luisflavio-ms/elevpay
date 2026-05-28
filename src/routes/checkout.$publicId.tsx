import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { User, Mail, Phone, IdCard, Lock, ShieldCheck } from "lucide-react";
import logoMark from "@/assets/logo-mark.webp";
import type { Checkout, Product, OrderBump, PaymentMethod } from "@/lib/types";
import { brl } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { rowToCheckout, type CheckoutRow } from "@/lib/checkout-mapper";
import { createPixPayment, checkOrderStatus } from "@/lib/abacate.functions";
import { getVapidPublicKey, subscribePush } from "@/lib/push.functions";

const BUYER_STORAGE_KEY = "elevpay:buyer";

const BlockRenderer = lazy(() =>
  import("@/components/checkout/BlockRenderer").then((m) => ({ default: m.BlockRenderer })),
);

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL as string).origin;
  } catch {
    return "";
  }
})();

type CheckoutLoadResult =
  | { data: { c: Checkout; p: Product; b?: OrderBump; priceOverride: number }; blocked: null }
  | { data: null; blocked: "notfound" | "no_product" | "invalid_amount" | "error" };

async function fetchCheckoutData(publicId: string): Promise<CheckoutLoadResult> {
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("get_public_checkout", {
      p_public_id: publicId,
    });
    if (rpcErr) throw rpcErr;

    const payload = (rpcData ?? {}) as {
      checkout: CheckoutRow | null;
      variant: { checkout_id: string; amount: number } | null;
      product: {
        id: string;
        name: string;
        description: string | null;
        image: string | null;
        type: Product["type"];
        delivery_url: string | null;
      } | null;
      order_bump: {
        id: string;
        title: string | null;
        description: string | null;
        price: number;
        compare_at_price: number | null;
        product_id: string | null;
      } | null;
      order_bump_product: { name: string | null; image: string | null } | null;
    };

    const ckRow = payload.checkout;
    if (!ckRow) return { data: null, blocked: "notfound" };

    const c = rowToCheckout(ckRow as unknown as CheckoutRow);
    if (!c.productId) return { data: null, blocked: "no_product" };

    const pRow = payload.product;
    if (!pRow) return { data: null, blocked: "no_product" };

    const variant = payload.variant;
    const priceOverride = variant ? Number(variant.amount) : c.amount;
    c.amount = priceOverride;
    if (!(priceOverride > 0)) return { data: null, blocked: "invalid_amount" };

    const p: Product = {
      id: pRow.id,
      name: pRow.name,
      description: pRow.description ?? "",
      image: pRow.image ?? "",
      type: pRow.type,
      deliveryUrl: pRow.delivery_url ?? "",
    };

    const bRow = payload.order_bump;
    const bumpProductName = payload.order_bump_product?.name ?? undefined;
    const bumpProductImage = payload.order_bump_product?.image ?? undefined;

    const b: OrderBump | undefined = bRow
      ? {
          id: bRow.id,
          title: bRow.title || bumpProductName || "",
          description: bRow.description ?? "",
          price: Number(bRow.price),
          compareAtPrice:
            bRow.compare_at_price == null ? undefined : Number(bRow.compare_at_price),
          productId: bRow.product_id ?? undefined,
          productName: bumpProductName,
          productImage: bumpProductImage,
        }
      : undefined;

    return { data: { c, p, b, priceOverride }, blocked: null };
  } catch {
    return { data: null, blocked: "error" };
  }
}

export const Route = createFileRoute("/checkout/$publicId")({
  component: PublicCheckout,
  // CSR-only: fetch acontece no browser para manter TTFB baixo
  head: () => ({
    meta: [
      { title: "Finalize sua compra - ElevPay" },
      { name: "description", content: "Pagamento rápido e seguro via ElevPay." },
    ],
    links: [
      ...(SUPABASE_ORIGIN ? [{ rel: "preconnect", href: SUPABASE_ORIGIN, crossorigin: "" }] : []),
      { rel: "dns-prefetch", href: "https://api.abacatepay.com" },
    ],
  }),
});


/**
 * Public checkout — busca pelo public_id curto (10 chars).
 * Pode ser o public_id do próprio checkout OU de uma variação de preço.
 */
function PublicCheckout() {
  const { publicId } = Route.useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{ c: Checkout; p: Product; b?: OrderBump; priceOverride: number } | null>(null);
  const [blocked, setBlocked] = useState<"notfound" | "no_product" | "invalid_amount" | "error" | null>(null);
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

  // Fetch CSR para manter TTFB baixo
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCheckoutData(publicId).then((res) => {
      if (cancelled) return;
      if (res.data) {
        setData(res.data);
        const c = res.data.c;
        setMethod(c.paymentMethods.pix ? "pix" : c.paymentMethods.card ? "cartao" : "boleto");
        if (c.scarcityTimerMinutes > 0) setSecondsLeft(c.scarcityTimerMinutes * 60);
        // SEO/title dinâmico
        if (typeof document !== "undefined") {
          document.title = `Finalize sua compra - ${res.data.p.name} - ElevPay`;
        }
      } else {
        setBlocked(res.blocked);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [publicId]);



  // Captura UTM params da URL (anúncios) e persiste durante a sessão.
  const utm = useMemo(() => {
    if (typeof window === "undefined") return {};
    const KEY = `elevpay:utm:${publicId}`;
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = {
      source: sp.get("utm_source") ?? undefined,
      medium: sp.get("utm_medium") ?? undefined,
      campaign: sp.get("utm_campaign") ?? undefined,
      term: sp.get("utm_term") ?? undefined,
      content: sp.get("utm_content") ?? undefined,
    };
    const hasAny = Object.values(fromUrl).some(Boolean);
    if (hasAny) {
      try { sessionStorage.setItem(KEY, JSON.stringify(fromUrl)); } catch {}
      return fromUrl;
    }
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as typeof fromUrl;
    } catch {}
    return {};
  }, [publicId]);


  const createPix = useServerFn(createPixPayment);
  const checkStatus = useServerFn(checkOrderStatus);

  const subscribePushFn = useServerFn(subscribePush);
  const getVapidKeyFn = useServerFn(getVapidPublicKey);

  const enablePushForOrder = async (orderId: string) => {
    try {
      // Detecta iframe (preview do Lovable bloqueia Notification API)
      const inIframe = (() => {
        try {
          return window.self !== window.top;
        } catch {
          return true;
        }
      })();
      if (inIframe) {
        setPayError(
          "Notificações só funcionam no app publicado (abra em https://elevpay.lovable.app), não no preview do editor.",
        );
        return;
      }
      if (typeof Notification === "undefined") {
        setPayError("Seu navegador não suporta notificações.");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPayError("Seu navegador não suporta notificações push.");
        return;
      }

      // IMPORTANTE: requestPermission precisa ser chamado direto no gesto do usuário,
      // sem awaits antes. Por isso é a primeira chamada async.
      const perm = await Notification.requestPermission();
      if (perm === "denied") {
        setPayError("Permissão negada. Habilite notificações nas configurações do navegador.");
        return;
      }
      if (perm !== "granted") {
        setPayError("Permissão não concedida.");
        return;
      }

      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
      }
      reg = await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const [{ urlBase64ToUint8Array }, { publicKey }] = await Promise.all([
          import("@/lib/push-config"),
          getVapidKeyFn(),
        ]);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
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
      setPayError("✅ Notificações ativadas! Você será avisado quando o pagamento for aprovado.");
    } catch (err) {
      setPayError("Erro ao ativar notificações: " + (err as Error).message);
    }
  };

  // Autofill: restaura dados do comprador salvos localmente em compras anteriores
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BUYER_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<typeof form>;
      setForm((prev) => ({
        name: prev.name || saved.name || "",
        email: prev.email || saved.email || "",
        whatsapp: prev.whatsapp || saved.whatsapp || "",
        cpf: prev.cpf || saved.cpf || "",
      }));
    } catch {
      /* ignore */
    }
  }, []);

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
          navigate({
            to: "/obrigado/$orderId",
            params: { orderId: pix.orderId },
            search: {
              email: form.email || undefined,
              product: data?.p?.name || undefined,
              amount: pix.amount,
              redirect: data?.c?.redirectUrl || undefined,
            },
          });
        }
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [pix, paid, checkStatus, navigate, form.email, data]);



  if (!data) {
    const blocked = loaderData?.blocked;
    const msg =
      blocked === "no_product"
        ? "Este checkout está temporariamente indisponível. Entre em contato com o vendedor."
        : blocked === "invalid_amount"
          ? "Este checkout possui um valor inválido. Entre em contato com o vendedor."
          : "Verifique o link e tente novamente.";
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui", padding: 16 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Checkout indisponível</h1>
          <p style={{ color: "#64748b" }}>{msg}</p>
        </div>
      </div>
    );
  }


  const { c, p, b } = data;
  const total = c.amount + (bumpOn && b ? b.price : 0);
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
    let r = (s * 10) % 11;
    if (r === 10) r = 0;
    if (r !== parseInt(c[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
    r = (s * 10) % 11;
    if (r === 10) r = 0;
    return r === parseInt(c[10]);
  };
  const isValidPhone = (v: string) => {
    const d = v.replace(/\D/g, "");
    return d.length === 10 || d.length === 11;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.cpf || !form.whatsapp) return;
    if (!isValidCpf(form.cpf)) {
      setPayError("CPF inválido");
      return;
    }
    if (!isValidPhone(form.whatsapp)) {
      setPayError("WhatsApp inválido");
      return;
    }

    setSubmitting(true);
    setPayError(null);
    try {
      localStorage.setItem(BUYER_STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
    try {
      if (method === "pix") {
        const result = await createPix({
          data: {
            publicId,
            customer: {
              name: form.name,
              email: form.email,
              cpf: form.cpf,
              phone: form.whatsapp,
            },
            bumpOn,
            utm,
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
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 16 }}>
        {secondsLeft > 0 && (
          <div
            style={{
              background: color,
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 10,
              textAlign: "center",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            ⏳ Oferta expira em{" "}
            <b>
              {mm}:{ss}
            </b>
          </div>
        )}
        {c.urgencyMessage && (
          <div
            style={{
              background: "#fef3c7",
              color: "#92400e",
              padding: "8px 12px",
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            {c.urgencyMessage}
          </div>
        )}

        {(c.blocks ?? []).filter((b) => (b.position ?? "above") === "above").length > 0 && (
          <Suspense fallback={null}>
            <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
              {(c.blocks ?? [])
                .filter((b) => (b.position ?? "above") === "above")
                .map((b) => (
                  <BlockRenderer key={b.id} block={b} color={color} asToast={b.type === "notifications"} />
                ))}
            </div>
          </Suspense>
        )}

        {c.image && (
          <img
            src={c.image}
            alt=""
            loading="eager"
            // @ts-expect-error fetchpriority is valid HTML attr
            fetchpriority="high"
            decoding="async"
            style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 12, marginBottom: 12 }}
          />
        )}

        <h1 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>{c.headline}</h1>
        {c.subheadline && <p style={{ color: "#475569", marginTop: 6 }}>{c.subheadline}</p>}

        {p && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 14,
              marginTop: 14,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "#64748b",
                paddingBottom: 10,
                marginBottom: 12,
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              Resumo do pedido
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            {p.image && (
              <img
                src={p.image}
                alt={p.name}
                loading="lazy"
                style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
              />
            )}
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
              {p.description && (
                <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.3 }}>{p.description}</span>
              )}
              <span style={{ fontSize: 20, fontWeight: 800, color, marginTop: 2 }}>{brl(c.amount)}</span>
            </div>
          </div>
          </div>

        )}

        {c.benefits.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "14px 0", fontSize: 14 }}>
            {c.benefits.filter(Boolean).map((bn, i) => (
              <li key={i} style={{ padding: "4px 0" }}>
                <span style={{ color, marginRight: 8 }}>✓</span>
                {bn}
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={submit}
          style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginTop: 8 }}
        >
          <h3 style={{ fontSize: 14, margin: "0 0 10px", fontWeight: 600 }}>Seus dados</h3>
          <Input
            placeholder="Nome completo"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            icon={<User size={16} />}
            autoComplete="name"
          />
          <Input
            placeholder="E-mail que irá receber a compra"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            icon={<Mail size={16} />}
            autoComplete="email"
            inputMode="email"
          />
          <Input
            placeholder="(DDD) 99999-9999"
            value={form.whatsapp}
            onChange={(v) => setForm({ ...form, whatsapp: maskPhone(v) })}
            icon={<Phone size={16} />}
            autoComplete="tel"
            inputMode="tel"
          />
          <Input
            placeholder="CPF 000.000.000-00"
            value={form.cpf}
            onChange={(v) => setForm({ ...form, cpf: maskCpf(v) })}
            icon={<IdCard size={16} />}
            autoComplete="off"
            inputMode="numeric"
          />

          <h3 style={{ fontSize: 14, margin: "14px 0 8px", fontWeight: 600 }}>Pagamento</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {c.paymentMethods.pix && (
              <PayBtn label="Pix" icon={<PixIcon />} active={method === "pix"} color={color} onClick={() => setMethod("pix")} />
            )}
            {c.paymentMethods.card && (
              <PayBtn label="Cartão" active={method === "cartao"} color={color} onClick={() => setMethod("cartao")} />
            )}
            {c.paymentMethods.boleto && (
              <PayBtn label="Boleto" active={method === "boleto"} color={color} onClick={() => setMethod("boleto")} />
            )}
          </div>

          {method === "pix" && !pix && <PixInstructions amount={total} color={color} />}

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
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  textAlign: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: 8,
                }}
              >
                Aproveite e compre junto:
              </div>
              <div
                style={{
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", gap: 12, padding: 12, alignItems: "flex-start" }}>
                  {b.productImage && (
                    <img
                      src={b.productImage}
                      alt={b.productName ?? b.title}
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: "cover",
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                      {b.productName ?? b.title}
                    </div>
                    {b.description && (
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4, lineHeight: 1.45 }}>
                        {b.description}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8, fontWeight: 600 }}>
                      🎁 Adicione{b.compareAtPrice && b.compareAtPrice > b.price
                        ? ` com ${Math.round(((b.compareAtPrice - b.price) / b.compareAtPrice) * 100)}% de desconto`
                        : ""}, por apenas {brl(b.price)}!
                    </div>
                    <div style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {b.compareAtPrice != null && b.compareAtPrice > b.price && (
                        <>
                          <span style={{ fontSize: 12, color: "#94a3b8", textDecoration: "line-through" }}>
                            {brl(b.compareAtPrice)}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#fff",
                              background: "#16a34a",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            ↓ {Math.round(((b.compareAtPrice - b.price) / b.compareAtPrice) * 100)}%
                          </span>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
                      {brl(b.price)}
                    </div>
                  </div>
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: "#dcfce7",
                    cursor: "pointer",
                    borderTop: "1.5px solid #e2e8f0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={bumpOn}
                    onChange={(e) => setBumpOn(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: "pointer", accentColor: color }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                    {bumpOn ? "Produto adicionado" : "Adicionar produto"}
                  </span>
                </label>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: "#f1f5f9",
              borderRadius: 10,
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
            }}
          >
            <span>Total</span>
            <span>{brl(total)}</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "14px 16px",
              background: color,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Processando..." : "Finalizar compra"}
          </button>

          {c.secureSeal && (
            <p style={{ textAlign: "center", fontSize: 12, color: "#64748b", marginTop: 10 }}>
              🔒 Compra 100% segura • SSL criptografado
            </p>
          )}
          {c.guarantee && (
            <p style={{ textAlign: "center", fontSize: 12, color: "#475569", marginTop: 2 }}>🛡️ {c.guarantee}</p>
          )}
        </form>

        {(c.blocks ?? []).filter((b) => b.position === "below").length > 0 && (
          <Suspense fallback={null}>
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {(c.blocks ?? [])
                .filter((b) => b.position === "below")
                .map((b) => (
                  <BlockRenderer key={b.id} block={b} color={color} asToast={b.type === "notifications"} />
                ))}
            </div>
          </Suspense>
        )}

        {c.testimonials.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8, fontWeight: 600 }}>O que dizem</h3>
            {c.testimonials.map((t, i) => (
              <div
                key={i}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <p style={{ fontSize: 13, margin: 0 }}>"{t.text}"</p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 4, marginBottom: 0 }}>— {t.name}</p>
              </div>
            ))}
          </div>
        )}

        <footer
          style={{
            marginTop: 28,
            paddingTop: 24,
            paddingBottom: 24,
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <img src={logoMark} alt="ElevPay" style={{ height: 36, width: "auto" }} />
          <p style={{ fontSize: 13, color: "#64748b", margin: 0, textAlign: "center" }}>
            {new Date().getFullYear()} ElevPay. Todos os direitos reservados.
          </p>
          <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#64748b", flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Lock size={16} color="#10b981" /> Compra 100% segura
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={16} color="#10b981" /> Site protegido
            </span>
          </div>
        </footer>
      </div>

      {payError && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            right: 16,
            background: "#fee2e2",
            color: "#991b1b",
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
            textAlign: "center",
            maxWidth: 528,
            margin: "0 auto",
          }}
        >
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
  icon?: React.ReactNode;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric" | "decimal" | "search" | "url" | "none";
}) {
  return (
    <div style={{ position: "relative", marginBottom: 8 }}>
      {props.icon && (
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#94a3b8",
            display: "inline-flex",
            pointerEvents: "none",
          }}
        >
          {props.icon}
        </span>
      )}
      <input
        type={props.type || "text"}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange?.(e.target.value)}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        style={{
          width: "100%",
          padding: props.icon ? "11px 12px 11px 38px" : "11px 12px",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function PayBtn({
  label,
  active,
  color,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: icon ? "10px 8px" : "10px 8px",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 13,
        border: active ? `2px solid ${color}` : "1px solid #cbd5e1",
        background: active ? color + "10" : "#fff",
        color: active ? color : "#0f172a",
        display: "inline-flex",
        flexDirection: icon ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: icon ? 4 : 6,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function PixIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="#32BCAD" aria-hidden="true">
      <path d="M11.917 11.71a2.046 2.046 0 0 1-1.454-.602l-2.1-2.1a.4.4 0 0 0-.551 0l-2.108 2.108a2.044 2.044 0 0 1-1.454.602h-.414l2.66 2.66c.83.83 2.177.83 3.007 0l2.667-2.668h-.253zM4.25 4.282c.55 0 1.066.214 1.454.602l2.108 2.108a.39.39 0 0 0 .552 0l2.1-2.1a2.044 2.044 0 0 1 1.453-.602h.253L9.503 1.623a2.127 2.127 0 0 0-3.007 0l-2.66 2.66h.414z" />
      <path d="m14.377 6.496-1.612-1.612a.307.307 0 0 1-.114.023h-.733c-.379 0-.75.154-1.017.422l-2.1 2.1a1.005 1.005 0 0 1-1.425 0L5.268 5.32a1.448 1.448 0 0 0-1.018-.422h-.9a.306.306 0 0 1-.109-.021L1.623 6.496c-.83.83-.83 2.177 0 3.008l1.618 1.618a.305.305 0 0 1 .108-.022h.901c.38 0 .75-.153 1.018-.421L7.375 8.57a1.034 1.034 0 0 1 1.426 0l2.1 2.1c.267.268.638.421 1.017.421h.733c.04 0 .079.01.114.024l1.612-1.612c.83-.83.83-2.178 0-3.008z" />
    </svg>
  );
}

function PixInstructions({ amount, color }: { amount: number; color: string }) {
  const steps = [
    {
      title: "Copie os dados de pagamento",
      text: 'Após clicar no botão "FINALIZAR PAGAMENTO", você poderá escanear o QR Code ou copiar a chave PIX "copia e cola".',
    },
    {
      title: "Realize o pagamento no seu banco de preferência",
      text: 'Com o QR Code e a chave PIX em mãos, basta você abrir o aplicativo do seu banco, escolher a opção PIX, escanear o QR Code ou colar a chave "copia e cola" que foi gerada.',
    },
    {
      title: "Pronto!",
      text: "Após realizar o pagamento, nosso sistema processará e liberará o seu pedido em instantes.",
    },
  ];
  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      <div
        style={{
          background: "#dcfce7",
          color: "#15803d",
          fontWeight: 700,
          fontSize: 12,
          padding: "10px 12px",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        LIBERAÇÃO IMEDIATA AO PAGAR NO PIX!
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
        Compra à vista: {brl(amount)}
      </div>
      {steps.map((s, i) => (
        <div
          key={i}
          style={{
            background: "#f1f5f9",
            borderRadius: 10,
            padding: 12,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              minWidth: 28,
              height: 28,
              borderRadius: "50%",
              background: color,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {i + 1}
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{s.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function skeleton(h: number): React.CSSProperties {
  return {
    height: h,
    background: "linear-gradient(90deg, #e2e8f0, #f1f5f9, #e2e8f0)",
    backgroundSize: "200% 100%",
    borderRadius: 10,
    animation: "elev-pulse 1.2s linear infinite",
  };
}

function SuccessModal({
  method,
  amount,
  onClose,
  redirect,
  pix,
  paid,
  onEnablePush,
}: {
  method: PaymentMethod;
  amount: number;
  onClose: () => void;
  redirect: string;
  pix: { orderId: string; qr: string; copy: string; amount: number } | null;
  paid: boolean;
  onEnablePush: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 50,
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
            <div
              style={{
                width: 220,
                height: 220,
                margin: "16px auto",
                background: "#fff",
                padding: 8,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <img
                src={pix.qr.startsWith("data:") ? pix.qr : `data:image/png;base64,${pix.qr}`}
                alt="QR Code Pix"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
            <div
              style={{
                background: "#f1f5f9",
                borderRadius: 8,
                padding: 10,
                fontFamily: "monospace",
                fontSize: 11,
                wordBreak: "break-all",
              }}
            >
              {pix.copy}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(pix.copy)}
              style={{
                width: "100%",
                marginTop: 10,
                padding: 12,
                background: "#0f172a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Copiar código Pix
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "#64748b", marginTop: 8 }}>
              Valor: <b>{brl(pix.amount)}</b>
            </p>
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
            <div
              style={{
                background: "#f1f5f9",
                borderRadius: 8,
                padding: 12,
                marginTop: 14,
                fontFamily: "monospace",
                fontSize: 12,
              }}
            >
              23793.38128 60082.111111 11111.111111 1 99990000{Math.floor(amount * 100)}
            </div>
            <button
              style={{
                width: "100%",
                marginTop: 10,
                padding: 12,
                background: "#0f172a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
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
          style={{
            width: "100%",
            marginTop: 14,
            padding: 12,
            background: "transparent",
            color: "#64748b",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {redirect ? "Ir para próxima etapa" : "Fechar"}
        </button>
      </div>
      <style>{`@keyframes elev-pulse { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}
