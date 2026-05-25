import { Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  Webhook,
  Settings,
  Menu,
  X,
  Zap,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { seedIfNeeded } from "@/lib/store";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/produtos", label: "Produtos", icon: Package },
  { to: "/app/checkouts", label: "Checkouts", icon: ShoppingCart },
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

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-background border-b px-4 h-14">
        <Link to="/app/dashboard" className="flex items-center gap-2 font-bold">
          <Zap className="h-5 w-5 text-primary" />
          ElevPay
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-background border-r flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-background flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <Link to="/app/dashboard" className="flex items-center gap-2 font-bold">
                <Zap className="h-5 w-5 text-primary" /> ElevPay
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
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );

  function SidebarContent() {
    return (
      <>
        <div className="hidden lg:flex items-center gap-2 px-6 h-16 border-b font-bold text-lg">
          <Zap className="h-6 w-6 text-primary" />
          ElevPay
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
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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
