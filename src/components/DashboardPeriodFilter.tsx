import { useState } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "14d"
  | "30d"
  | "specific"
  | "range";

export type PeriodValue = {
  preset: PeriodPreset;
  specific?: Date;
  from?: Date;
  to?: Date;
};

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 Dias" },
  { value: "14d", label: "14 Dias" },
  { value: "30d", label: "30 Dias" },
  { value: "specific", label: "Específico" },
  { value: "range", label: "Intervalo" },
];

export function periodLabel(v: PeriodValue): string {
  if (v.preset === "specific" && v.specific) {
    return format(v.specific, "dd/MM/yyyy", { locale: ptBR });
  }
  if (v.preset === "range" && v.from && v.to) {
    return `${format(v.from, "dd/MM", { locale: ptBR })} - ${format(v.to, "dd/MM", { locale: ptBR })}`;
  }
  return PRESETS.find((p) => p.value === v.preset)?.label ?? "Hoje";
}

export function periodRange(v: PeriodValue): { start: Date; end: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  switch (v.preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "7d":
    case "14d":
    case "30d": {
      const days = v.preset === "7d" ? 7 : v.preset === "14d" ? 14 : 30;
      const s = new Date(now);
      s.setDate(s.getDate() - (days - 1));
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case "specific":
      return v.specific
        ? { start: startOfDay(v.specific), end: endOfDay(v.specific) }
        : { start: startOfDay(now), end: endOfDay(now) };
    case "range":
      return v.from && v.to
        ? { start: startOfDay(v.from), end: endOfDay(v.to) }
        : { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function DashboardPeriodFilter({
  value,
  onChange,
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}) {
  const [specOpen, setSpecOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span>Período: {periodLabel(value)}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {PRESETS.map((p) => (
            <DropdownMenuItem
              key={p.value}
              onSelect={(e) => {
                if (p.value === "specific") {
                  e.preventDefault();
                  setSpecOpen(true);
                  return;
                }
                if (p.value === "range") {
                  e.preventDefault();
                  setRangeOpen(true);
                  return;
                }
                onChange({ preset: p.value });
              }}
              className={cn(
                value.preset === p.value &&
                  "bg-primary/15 text-primary focus:bg-primary/20 focus:text-primary",
              )}
            >
              {p.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={specOpen} onOpenChange={setSpecOpen}>
        <DialogContent className="w-auto max-w-fit">
          <DialogHeader>
            <DialogTitle>Selecione uma data</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={value.specific}
            onSelect={(d) => {
              if (d) {
                onChange({ preset: "specific", specific: d });
                setSpecOpen(false);
              }
            }}
            initialFocus
            locale={ptBR}
            className={cn("p-3 pointer-events-auto")}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
        <DialogContent className="w-auto max-w-fit">
          <DialogHeader>
            <DialogTitle>Selecione um intervalo</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="range"
            selected={{ from: value.from, to: value.to }}
            onSelect={(r: any) => {
              if (r?.from && r?.to) {
                onChange({ preset: "range", from: r.from, to: r.to });
                setRangeOpen(false);
              } else if (r?.from) {
                onChange({ preset: "range", from: r.from, to: r.to });
              }
            }}
            numberOfMonths={2}
            initialFocus
            locale={ptBR}
            className={cn("p-3 pointer-events-auto")}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
