export type ProductType = "digital" | "fisico" | "assinatura";

export interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  type: ProductType;
  deliveryUrl: string;
}

export interface PriceVariant {
  id: string;
  publicId: string;
  checkoutId: string;
  amount: number;
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
  publicId: string;
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
  blocks?: CheckoutBlock[];
}

export type CheckoutBlockType =
  | "image"
  | "text"
  | "html"
  | "timer"
  | "guarantee"
  | "notifications"
  | "secureSeal";

export interface CheckoutBlockBase {
  id: string;
  type: CheckoutBlockType;
}
export interface ImageBlock extends CheckoutBlockBase {
  type: "image";
  src: string;
  alt: string;
  rounded: boolean;
}
export interface TextBlock extends CheckoutBlockBase {
  type: "text";
  content: string;
  size: "sm" | "md" | "lg" | "xl";
  align: "left" | "center" | "right";
  bold: boolean;
}
export interface HtmlBlock extends CheckoutBlockBase {
  type: "html";
  code: string;
}
export interface TimerBlock extends CheckoutBlockBase {
  type: "timer";
  minutes: number;
  label: string;
}
export interface GuaranteeBlock extends CheckoutBlockBase {
  type: "guarantee";
  days: number;
  title: string;
  text: string;
}
export interface PurchaseNotification {
  name: string;
  product: string;
  city: string;
  ago: string;
}
export interface NotificationsBlock extends CheckoutBlockBase {
  type: "notifications";
  items: PurchaseNotification[];
  intervalSec: number;
}
export interface SecureSealBlock extends CheckoutBlockBase {
  type: "secureSeal";
  text: string;
}
export type CheckoutBlock =
  | ImageBlock
  | TextBlock
  | HtmlBlock
  | TimerBlock
  | GuaranteeBlock
  | NotificationsBlock
  | SecureSealBlock;

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
