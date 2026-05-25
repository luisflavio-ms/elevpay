import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, ShieldCheck, Rocket, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Zap className="h-5 w-5 text-primary" /> ElevPay
        </div>
        <Link to="/app/dashboard">
          <Button size="sm">Entrar no Dashboard</Button>
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-12 pb-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary text-xs font-medium px-3 py-1 mb-6">
          <Rocket className="h-3 w-3" /> Checkouts que carregam em milissegundos
        </span>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
          O checkout mais rápido<br /> do Brasil para vender mais.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Crie páginas de checkout otimizadas para conversão em minutos. Pix,
          cartão, boleto, order bumps e tudo que você precisa para escalar.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/app/dashboard">
            <Button size="lg" className="w-full sm:w-auto">
              Entrar no Dashboard
            </Button>
          </Link>
          <Link to="/checkout/$slug" params={{ slug: "trafego-pago-pro" }}>
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Ver checkout demo
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid sm:grid-cols-3 gap-6 text-left">
          {[
            { icon: Rocket, title: "Carregamento <300ms", desc: "Checkouts ultraleves otimizados para mobile." },
            { icon: BarChart3, title: "Conversão alta", desc: "Order bump, escassez e pixels integrados." },
            { icon: ShieldCheck, title: "Antifraude", desc: "Selos de segurança e validação por padrão." },
          ].map((f) => (
            <div key={f.title} className="bg-card border rounded-2xl p-6">
              <f.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
