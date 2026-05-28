import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

const isSafePublicUrl = (u: string): boolean => {
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const searchSchema = z.object({
  email: z.string().email().max(255).optional().catch(undefined),
  product: z.string().max(200).optional().catch(undefined),
  amount: z.coerce.number().min(0).max(1_000_000).optional().catch(undefined),
  redirect: z
    .string()
    .max(2048)
    .refine(isSafePublicUrl, { message: "Invalid redirect URL" })
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/obrigado/$orderId")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ThankYou,
  head: () => ({
    meta: [
      { title: "Obrigado pela sua compra - ElevPay" },
      { name: "description", content: "Pagamento confirmado. Enviamos seu acesso por email." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ThankYou() {
  const { orderId } = Route.useParams();
  const { email, product, amount, redirect } = Route.useSearch();
  const shortId = orderId.slice(0, 8).toUpperCase();
  const fmtAmount =
    typeof amount === "number"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
      : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #faf8ff 0%, #f5f3fa 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#0f0a1f",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 10px 40px -10px rgba(124, 58, 237, 0.25)",
          padding: 32,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 36,
            color: "#fff",
          }}
        >
          ✓
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>
          Obrigado pela sua compra!
        </h1>
        <p style={{ color: "#5b5470", fontSize: 15, margin: "0 0 24px", lineHeight: 1.5 }}>
          Seu pagamento foi confirmado com sucesso.
        </p>

        <div
          style={{
            background: "#f5f0ff",
            border: "1px solid #e4d6ff",
            borderRadius: 12,
            padding: 18,
            textAlign: "left",
            margin: "0 0 20px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed", marginBottom: 10 }}>
            📧 Enviamos seu acesso por email
          </div>
          {email && (
            <p style={{ fontSize: 14, color: "#0f0a1f", margin: "0 0 8px", wordBreak: "break-all" }}>
              Para: <b>{email}</b>
            </p>
          )}
          <p style={{ fontSize: 13, color: "#5b5470", margin: 0, lineHeight: 1.5 }}>
            Verifique sua caixa de entrada (e a pasta de spam). O email contém o link de acesso
            {product ? <> ao <b>{product}</b></> : null}.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            padding: "14px 0",
            borderTop: "1px solid #eee6f7",
            borderBottom: "1px solid #eee6f7",
            margin: "0 0 20px",
            fontSize: 13,
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ color: "#8a8597", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Pedido
            </div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>#{shortId}</div>
          </div>
          {fmtAmount && (
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#8a8597", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Valor pago
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{fmtAmount}</div>
            </div>
          )}
        </div>

        {redirect ? (
          <a
            href={redirect}
            style={{
              display: "block",
              width: "100%",
              padding: "14px 20px",
              background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
              cursor: "pointer",
              boxSizing: "border-box",
            }}
          >
            Continuar
          </a>
        ) : (
          <p style={{ fontSize: 12, color: "#8a8597", margin: 0 }}>
            Não recebeu o email em alguns minutos? Verifique a pasta de spam ou entre em contato com o suporte.
          </p>
        )}

        <div style={{ marginTop: 20, fontSize: 11, color: "#a8a3b5" }}>
          Processado por <Link to="/" style={{ color: "#7c3aed", fontWeight: 600 }}>ElevPay</Link>
        </div>
      </div>
    </div>
  );
}
