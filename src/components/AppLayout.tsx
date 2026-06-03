import { Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Gift,
  Receipt,
  TrendingUp,
  Webhook,
  Settings,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { seedIfNeeded } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark, Wordmark } from "@/components/Logo";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";


const nav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/produtos", label: "Produtos", icon: Package },
  { to: "/app/order-bumps", label: "Order bumps", icon: Gift },
  { to: "/app/vendas", label: "Vendas", icon: TrendingUp },
  { to: "/app/pedidos", label: "Pedidos", icon: Receipt },
  { to: "/app/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const router = useRouter();

  useEffect(() => {
    seedIfNeeded();
  }, []);
  useEffect(() => setOpen(false), [loc.pathname]);

  // Toca som quando uma venda é aprovada (realtime)
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const audio = new Audio("/sounds/money.mp3");
    audio.preload = "auto";

    const playSale = () => {
      try {
        audio.currentTime = 0;
        void audio.play().catch(() => {});
      } catch {}
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`orders-sound-${uid}`)
        .on(
          "postgres_changes" as any,
          { event: "INSERT", schema: "public", table: "orders", filter: `user_id=eq.${uid}` },
          (payload: any) => {
            if (payload.new?.status === "aprovado") playSale();
          },
        )
        .on(
          "postgres_changes" as any,
          { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${uid}` },
          (payload: any) => {
            if (payload.new?.status === "aprovado" && payload.old?.status !== "aprovado") playSale();
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-sidebar border-b px-4 h-14">
        <Link to="/app/dashboard" aria-label="ElevPay">
          <Logo size={22} />
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu className="h-6 w-6" />
        </button>
      </header>


      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
              <Link to="/app/dashboard" aria-label="ElevPay">
                <Logo size={22} />
              </Link>
              <button onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <AppHeader />
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );

  function SidebarContent() {
    return (
      <>
        <div className="hidden lg:flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
          <LogoMark size={26} />
          <Wordmark className="text-lg" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const active = loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition-colors py-[16px]",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => router.navigate({ to: "/" })}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </>
    );
  }
}
