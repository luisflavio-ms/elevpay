import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Rocket, BarChart3, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, Wordmark } from "@/components/Logo";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Glow background */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 h-[600px]"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full blur-3xl opacity-30"
        style={{ background: "var(--gradient-primary)" }} />

      <header className="relative px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Logo size={28} />
        <Link to="/app/dashboard">
          <Button size="sm" className="rounded-full">
            Entrar no Dashboard <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </header>

      <main className="relative max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium px-3 py-1 mb-8">
          <Rocket className="h-3 w-3" /> Checkout otimizado para conversão
        </span>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05]">
          Checkouts que <br className="hidden sm:block" />
          <span
            className="italic"
            style={{
              background: "var(--gradient-primary)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            elevam
          </span>{" "}
          seus resultados.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          A plataforma de checkout mais rápida do Brasil. Pix, cartão, boleto,
          order bumps e tudo que você precisa para vender mais.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/app/dashboard">
            <Button
              size="lg"
              className="w-full sm:w-auto rounded-full px-7 h-12 text-base font-semibold"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              Entrar no Dashboard
            </Button>
          </Link>
          <Link to="/checkout/$slug" params={{ slug: "trafego-pago-pro" }}>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto rounded-full px-7 h-12 text-base border-border bg-card/50 backdrop-blur"
            >
              Ver checkout demo
            </Button>
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {["Rápido", "Seguro", "Completo"].map((w) => (
            <span key={w} className="inline-flex items-center gap-1.5">
              <Check className="h-3 w-3 text-primary" /> {w}
            </span>
          ))}
        </div>

        <div className="mt-24 grid sm:grid-cols-3 gap-4 text-left">
          {[
            { icon: Rocket, title: "Carregamento <300ms", desc: "Checkouts ultraleves otimizados para mobile-first." },
            { icon: BarChart3, title: "Conversão máxima", desc: "Order bump, escassez e pixels integrados nativamente." },
            { icon: ShieldCheck, title: "Antifraude", desc: "Selos de segurança e validação por padrão." },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-card/60 backdrop-blur border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors"
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "var(--gradient-primary)" }}
              >
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative border-t border-border py-6 text-center text-xs text-muted-foreground">
        © 2026 <Wordmark className="text-sm" /> • Todos os direitos reservados
      </footer>
    </div>
  );
}
