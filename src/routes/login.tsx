import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

const searchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: (search.redirect as string) || "/app/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: search.redirect || "/app/dashboard" });
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-[#04060f]">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full blur-3xl opacity-60"
             style={{ background: "radial-gradient(closest-side, #5b8cff 0%, transparent 70%)" }} />
        <div className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(closest-side, #7c4dff 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-32 h-[500px] w-[500px] rounded-full blur-3xl opacity-40"
             style={{ background: "radial-gradient(closest-side, #00c6ff 0%, transparent 70%)" }} />
      </div>

      {/* Glass card */}
      <div className="relative w-full max-w-md rounded-[28px] border border-white/15 bg-white/[0.04] backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] p-8 sm:p-10">
        {/* Inner highlight */}
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-b from-white/10 to-transparent opacity-60" />

        <div className="relative">
          <div className="flex justify-center mb-8">
            <Logo />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-white">Olá novamente!</h1>
            <p className="text-sm text-white/60 mt-2">Acesse sua conta ElevPay</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="email"
              required
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/20"
            />
            <div>
              <Input
                type="password"
                required
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/20"
              />
              <div className="flex justify-end mt-2">
                <Link to="/forgot-password" className="text-xs text-white/70 hover:text-white">
                  Esqueci minha senha
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl text-white font-medium border-0 shadow-lg shadow-blue-500/30 hover:opacity-95 transition-opacity"
              style={{
                background:
                  "linear-gradient(90deg, #6a5cff 0%, #4aa3ff 50%, #5ee0ff 100%)",
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>

          </form>

          <div className="mt-10 flex justify-center gap-4 text-xs text-white/40">
            <a href="#" className="underline hover:text-white/70">Termos de Serviço</a>
            <span>|</span>
            <a href="#" className="underline hover:text-white/70">Política de Privacidade</a>
          </div>
        </div>
      </div>
    </div>
  );
}
