import { Image as ImageIcon, Type, Code2, Timer, ShieldCheck, Bell, Lock, type LucideIcon } from "lucide-react";
import type { CheckoutBlock, CheckoutBlockType } from "@/lib/types";

export const BLOCK_LABELS: Record<CheckoutBlockType, string> = {
  image: "Imagem",
  text: "Texto",
  html: "HTML",
  timer: "Cronômetro",
  guarantee: "Garantia",
  notifications: "Notificações",
  secureSeal: "Selo seguro",
};

export const BLOCK_ICONS: Record<CheckoutBlockType, LucideIcon> = {
  image: ImageIcon,
  text: Type,
  html: Code2,
  timer: Timer,
  guarantee: ShieldCheck,
  notifications: Bell,
  secureSeal: Lock,
};

let n = 0;
const newId = () => `blk_${Date.now().toString(36)}_${(n++).toString(36)}`;

export function createBlock(type: CheckoutBlockType, position: "above" | "below" = "above"): CheckoutBlock {
  const id = newId();
  switch (type) {
    case "image":
      return {
        id, type, position, alt: "",
        src: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=70",
        rounded: true,
      };
    case "text":
      return {
        id, type, position,
        content: "Escreva aqui um texto persuasivo para o seu checkout.",
        size: "md", align: "left", bold: false,
      };
    case "html":
      return {
        id, type, position,
        code: '<div style="padding:12px;background:#fef3c7;border-radius:8px;text-align:center;font-size:13px">⚡ Código HTML personalizado</div>',
      };
    case "timer":
      return { id, type, position, minutes: 15, label: "Esta oferta expira em" };
    case "guarantee":
      return {
        id, type, position, days: 7,
        title: "Garantia incondicional",
        text: "Se você não gostar por qualquer motivo, devolvemos 100% do seu dinheiro.",
      };
    case "notifications":
      return {
        id, type, position, intervalSec: 10, delaySec: 6,
        items: [
          { name: "Maria S.", product: "acabou de comprar", city: "São Paulo, SP", ago: "há 2 min" },
          { name: "João P.", product: "acabou de comprar", city: "Rio de Janeiro, RJ", ago: "há 4 min" },
          { name: "Ana L.", product: "acabou de comprar", city: "Belo Horizonte, MG", ago: "há 7 min" },
        ],
      };
    case "secureSeal":
      return { id, type, position, text: "Compra 100% segura" };
  }
}
