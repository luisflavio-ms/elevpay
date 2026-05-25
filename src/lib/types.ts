export type ProductType = "digital" | "fisico" | "assinatura";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  type: ProductType;
  deliveryUrl: string;
}

export interface Testimonial {
  name: string;
  text: string;
}

export interface OrderBump {
  id: string;
  title: string;
  description: string;
  price: number;
}

export interface Checkout {
  id: string;
  slug: string;
  name: string;
  productId: string;
  headline: string;
  subheadline: string;
  image: string;
  benefits: string[];
  testimonials: Testimonial[];
  guarantee: string;
  primaryColor: string;
  buttonText: string;
  paymentMethods: { pix: boolean; card: boolean; boleto: boolean };
  orderBumpId?: string;
  pixelMeta: string;
  pixelGoogle: string;
  webhookUrl: string;
  redirectUrl: string;
  scarcityTimerMinutes: number;
  secureSeal: boolean;
  urgencyMessage: string;
  active: boolean;
  conversion: number;
  revenue: number;
}

export type OrderStatus = "aprovado" | "pendente" | "recusado" | "reembolsado";
export type PaymentMethod = "pix" | "cartao" | "boleto";

export interface Order {
  id: string;
  customer: string;
  productId: string;
  amount: number;
  status: OrderStatus;
  method: PaymentMethod;
  date: string;
}

export type WebhookEvent =
  | "payment.approved"
  | "payment.pending"
  | "payment.refused"
  | "payment.refunded"
  | "checkout.created";

export interface WebhookLog {
  id: string;
  event: WebhookEvent;
  date: string;
  payload: Record<string, unknown>;
}

export interface Settings {
  companyName: string;
  logo: string;
  customDomain: string;
  feePercent: number;
  withdrawAccount: string;
  pixKey: string;
}
