import type {
  Checkout,
  Order,
  OrderBump,
  Product,
  Settings,
  WebhookLog,
} from "./types";

const KEYS = {
  products: "elevpay:products",
  checkouts: "elevpay:checkouts",
  orders: "elevpay:orders",
  bumps: "elevpay:bumps",
  webhooks: "elevpay:webhooks",
  settings: "elevpay:settings",
  seeded: "elevpay:seeded",
};

const SEED_PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Curso Tráfego Pago Pro",
    description: "Domine Meta Ads e Google Ads do zero ao avançado.",
    price: 497,
    image:
      "https://images.unsplash.com/photo-1551434678-e076c223a692?w=600&q=70",
    type: "digital",
    deliveryUrl: "https://area.exemplo.com/trafego",
  },
  {
    id: "p2",
    name: "Mentoria E-commerce 6 meses",
    description: "Acompanhamento semanal para escalar sua loja.",
    price: 1997,
    image:
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=70",
    type: "assinatura",
    deliveryUrl: "https://area.exemplo.com/mentoria",
  },
  {
    id: "p3",
    name: "Kit Camisetas Premium",
    description: "Pack com 3 camisetas algodão peruano.",
    price: 249,
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=70",
    type: "fisico",
    deliveryUrl: "",
  },
];

const SEED_BUMPS: OrderBump[] = [
  {
    id: "b1",
    title: "Pack de Criativos Bônus",
    description: "+50 criativos prontos para escalar campanhas.",
    price: 47,
  },
  {
    id: "b2",
    title: "Planilha de Gestão",
    description: "Planilha completa de métricas e ROI.",
    price: 27,
  },
];

const SEED_CHECKOUTS: Checkout[] = [
  {
    id: "c1",
    slug: "trafego-pago-pro",
    name: "Checkout Tráfego Pago",
    productId: "p1",
    headline: "Aprenda a vender todo dia com tráfego pago",
    subheadline: "Método validado por +3.000 alunos",
    image:
      "https://images.unsplash.com/photo-1551434678-e076c223a692?w=600&q=70",
    benefits: [
      "Acesso vitalício ao curso",
      "Comunidade exclusiva no Discord",
      "Atualizações gratuitas",
      "Certificado de conclusão",
    ],
    testimonials: [
      { name: "Mariana S.", text: "Fiz minha primeira venda em 7 dias!" },
      { name: "Carlos R.", text: "Conteúdo direto ao ponto, recomendo." },
    ],
    guarantee: "7 dias de garantia incondicional",
    primaryColor: "#16a34a",
    buttonText: "Quero garantir minha vaga",
    paymentMethods: { pix: true, card: true, boleto: true },
    orderBumpId: "b1",
    pixelMeta: "1234567890",
    pixelGoogle: "G-XXXXXXX",
    webhookUrl: "https://webhook.site/mock",
    redirectUrl: "https://obrigado.exemplo.com",
    scarcityTimerMinutes: 15,
    secureSeal: true,
    urgencyMessage: "Últimas vagas com este preço!",
    active: true,
    conversion: 4.8,
    revenue: 24850,
    blocks: [],
  },
  {
    id: "c2",
    slug: "mentoria-ecom",
    name: "Checkout Mentoria",
    productId: "p2",
    headline: "Escale sua loja com mentoria semanal",
    subheadline: "Acompanhamento direto comigo por 6 meses",
    image:
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=70",
    benefits: [
      "Mentoria ao vivo semanal",
      "Grupo VIP no WhatsApp",
      "Auditoria de loja",
    ],
    testimonials: [
      { name: "Pedro M.", text: "Triplicou meu faturamento em 3 meses." },
    ],
    guarantee: "15 dias de garantia",
    primaryColor: "#7c3aed",
    buttonText: "Quero aplicar para a mentoria",
    paymentMethods: { pix: true, card: true, boleto: false },
    orderBumpId: "b2",
    pixelMeta: "",
    pixelGoogle: "",
    webhookUrl: "",
    redirectUrl: "",
    scarcityTimerMinutes: 30,
    secureSeal: true,
    urgencyMessage: "Apenas 5 vagas por turma",
    active: true,
    conversion: 2.1,
    revenue: 39940,
  },
  {
    id: "c3",
    slug: "kit-camisetas",
    name: "Checkout Camisetas",
    productId: "p3",
    headline: "Pack 3 camisetas premium com frete grátis",
    subheadline: "Algodão peruano, caimento perfeito",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=70",
    benefits: ["Frete grátis Brasil", "Troca em 30 dias", "Envio em 24h"],
    testimonials: [],
    guarantee: "30 dias para troca ou devolução",
    primaryColor: "#0ea5e9",
    buttonText: "Comprar agora",
    paymentMethods: { pix: true, card: true, boleto: true },
    pixelMeta: "",
    pixelGoogle: "",
    webhookUrl: "",
    redirectUrl: "",
    scarcityTimerMinutes: 0,
    secureSeal: true,
    urgencyMessage: "",
    active: false,
    conversion: 1.6,
    revenue: 4980,
  },
];

const SEED_ORDERS: Order[] = [
  { id: "o1", customer: "Ana Souza", productId: "p1", amount: 497, status: "aprovado", method: "pix", date: "2026-05-24T10:24:00Z" },
  { id: "o2", customer: "Bruno Lima", productId: "p1", amount: 497, status: "aprovado", method: "cartao", date: "2026-05-24T09:11:00Z" },
  { id: "o3", customer: "Carla Dias", productId: "p2", amount: 1997, status: "pendente", method: "boleto", date: "2026-05-23T20:45:00Z" },
  { id: "o4", customer: "Diego Reis", productId: "p3", amount: 249, status: "aprovado", method: "pix", date: "2026-05-23T17:02:00Z" },
  { id: "o5", customer: "Eduarda Melo", productId: "p1", amount: 497, status: "recusado", method: "cartao", date: "2026-05-22T14:30:00Z" },
  { id: "o6", customer: "Felipe Costa", productId: "p2", amount: 1997, status: "aprovado", method: "pix", date: "2026-05-22T11:18:00Z" },
  { id: "o7", customer: "Giovana Pires", productId: "p3", amount: 249, status: "reembolsado", method: "cartao", date: "2026-05-21T16:55:00Z" },
  { id: "o8", customer: "Henrique Alves", productId: "p1", amount: 497, status: "aprovado", method: "pix", date: "2026-05-21T08:09:00Z" },
];

const SEED_WEBHOOKS: WebhookLog[] = [
  { id: "w1", event: "payment.approved", date: "2026-05-24T10:24:05Z", payload: { orderId: "o1", amount: 497, method: "pix" } },
  { id: "w2", event: "payment.pending", date: "2026-05-23T20:45:01Z", payload: { orderId: "o3", amount: 1997 } },
  { id: "w3", event: "payment.refused", date: "2026-05-22T14:30:10Z", payload: { orderId: "o5", reason: "insufficient_funds" } },
  { id: "w4", event: "payment.refunded", date: "2026-05-21T16:55:30Z", payload: { orderId: "o7", amount: 249 } },
  { id: "w5", event: "checkout.created", date: "2026-05-20T12:00:00Z", payload: { checkoutId: "c1", slug: "trafego-pago-pro" } },
];

const SEED_SETTINGS: Settings = {
  companyName: "ElevPay Demo Ltda",
  logo: "",
  customDomain: "pay.minhaempresa.com.br",
  feePercent: 4.99,
  withdrawAccount: "Banco 260 • Ag 0001 • CC 12345-6",
  pixKey: "financeiro@elevpay.com",
};

function isClient() {
  return typeof window !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!isClient()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isClient()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function seedIfNeeded() {
  if (!isClient()) return;
  if (localStorage.getItem(KEYS.seeded)) return;
  write(KEYS.products, SEED_PRODUCTS);
  write(KEYS.checkouts, SEED_CHECKOUTS);
  write(KEYS.orders, SEED_ORDERS);
  write(KEYS.bumps, SEED_BUMPS);
  write(KEYS.webhooks, SEED_WEBHOOKS);
  write(KEYS.settings, SEED_SETTINGS);
  localStorage.setItem(KEYS.seeded, "1");
}

export const db = {
  getProducts: () => read<Product[]>(KEYS.products, SEED_PRODUCTS),
  setProducts: (v: Product[]) => write(KEYS.products, v),
  getCheckouts: () => read<Checkout[]>(KEYS.checkouts, SEED_CHECKOUTS),
  setCheckouts: (v: Checkout[]) => write(KEYS.checkouts, v),
  getOrders: () => read<Order[]>(KEYS.orders, SEED_ORDERS),
  setOrders: (v: Order[]) => write(KEYS.orders, v),
  getBumps: () => read<OrderBump[]>(KEYS.bumps, SEED_BUMPS),
  setBumps: (v: OrderBump[]) => write(KEYS.bumps, v),
  getWebhooks: () => read<WebhookLog[]>(KEYS.webhooks, SEED_WEBHOOKS),
  setWebhooks: (v: WebhookLog[]) => write(KEYS.webhooks, v),
  getSettings: () => read<Settings>(KEYS.settings, SEED_SETTINGS),
  setSettings: (v: Settings) => write(KEYS.settings, v),
};

export function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 50);
}
