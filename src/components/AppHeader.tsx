import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { Bell, Sun, Moon, ChevronDown, User, Wallet, ShoppingBag, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  produtos: "Produtos",
  checkouts: "Checkouts",
  vendas: "Vendas",
  pedidos: "Pedidos",
  webhooks: "Webhooks",
  configuracoes: "Configurações",
};

function useCrumbs() {
  const loc = useLocation();
  const parts = loc.pathname.split("/").filter(Boolean); // ["app", "vendas", ...]
  const segments = parts.slice(1); // drop "app"
  const crumbs: { label: string; to?: string }[] = [
    { label: "Dashboard", to: "/app/dashboard" },
  ];
  if (segments.length > 0 && segments[0] !== "dashboard") {
    const seg = segments[0];
    crumbs.push({ label: ROUTE_LABELS[seg] ?? seg });
  }
  return crumbs;
}

export function AppHeader() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const crumbs = useCrumbs();

  const user = {
    name: "Luis Flavio Marinho Silva",
    email: "luisflavio628@gmail.com",
    role: "Usuário",
  };
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">›</span>}
              {c.to ? (
                <Link
                  to={c.to}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="font-semibold text-foreground">{c.label}</span>
              )}
            </div>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Alternar tema"
            className="rounded-full"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notificações"
                className="rounded-full relative"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="px-4 py-3 border-b border-border">
                <p className="font-semibold text-sm">Notificações</p>
                <p className="text-xs text-muted-foreground">Você tem 3 novas</p>
              </div>
              <div className="max-h-80 overflow-auto divide-y divide-border">
                {[
                  { t: "Nova venda aprovada", d: "Pedido #1024 — R$ 197,00", time: "agora" },
                  { t: "Checkout publicado", d: "Curso Avançado de IA", time: "12 min" },
                  { t: "Webhook falhou", d: "Endpoint /pagamentos retornou 500", time: "1 h" },
                ].map((n, i) => (
                  <div key={i} className="px-4 py-3 hover:bg-muted/50 cursor-pointer">
                    <p className="text-sm font-medium">{n.t}</p>
                    <p className="text-xs text-muted-foreground">{n.d}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-border">
                <button className="text-xs text-primary hover:underline w-full text-center">
                  Ver todas
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="h-8 w-px bg-border mx-1 hidden sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 sm:gap-3 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-sm font-semibold text-foreground">
                    {user.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{user.role}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sm">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <User className="h-4 w-4 mr-2" /> Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Wallet className="h-4 w-4 mr-2" /> Meu Saldo
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <ShoppingBag className="h-4 w-4 mr-2" /> Minhas Compras
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.navigate({ to: "/login" });
                }}
              >
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
