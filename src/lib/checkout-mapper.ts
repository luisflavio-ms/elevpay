import type { Checkout, CheckoutBlock, Testimonial } from "./types";

export type CheckoutRow = {
  id: string;
  user_id: string;
  product_id: string | null;
  order_bump_id: string | null;
  public_id: string;
  amount: number | string;
  name: string;
  headline: string;
  subheadline: string;
  image: string | null;
  benefits: string[];
  testimonials: Testimonial[];
  guarantee: string;
  primary_color: string;
  button_text: string;
  payment_methods: { pix: boolean; card: boolean; boleto: boolean };
  pixel_meta: string | null;
  pixel_google: string | null;
  webhook_url: string | null;
  redirect_url: string | null;
  scarcity_timer_minutes: number;
  secure_seal: boolean;
  urgency_message: string;
  active: boolean;
  conversion: number | string;
  revenue: number | string;
  blocks: CheckoutBlock[];
};

export function rowToCheckout(r: CheckoutRow): Checkout {
  return {
    id: r.id,
    publicId: r.public_id,
    name: r.name,
    productId: r.product_id ?? "",
    headline: r.headline,
    subheadline: r.subheadline,
    image: r.image ?? "",
    benefits: r.benefits ?? [],
    testimonials: r.testimonials ?? [],
    guarantee: r.guarantee,
    primaryColor: r.primary_color,
    buttonText: r.button_text,
    paymentMethods: r.payment_methods ?? { pix: true, card: true, boleto: false },
    orderBumpId: r.order_bump_id ?? undefined,
    pixelMeta: r.pixel_meta ?? "",
    pixelGoogle: r.pixel_google ?? "",
    webhookUrl: r.webhook_url ?? "",
    redirectUrl: r.redirect_url ?? "",
    scarcityTimerMinutes: r.scarcity_timer_minutes,
    secureSeal: r.secure_seal,
    urgencyMessage: r.urgency_message,
    active: r.active,
    conversion: Number(r.conversion),
    revenue: Number(r.revenue),
    blocks: r.blocks ?? [],
  };
}

export function checkoutToRow(c: Checkout, userId: string): Omit<CheckoutRow, "id" | "public_id"> & { id?: string } {
  return {
    id: c.id || undefined,
    user_id: userId,
    product_id: c.productId || null,
    order_bump_id: c.orderBumpId ?? null,
    name: c.name,
    headline: c.headline,
    subheadline: c.subheadline,
    image: c.image || null,
    benefits: c.benefits ?? [],
    testimonials: c.testimonials ?? [],
    guarantee: c.guarantee,
    primary_color: c.primaryColor,
    button_text: c.buttonText,
    payment_methods: c.paymentMethods,
    pixel_meta: c.pixelMeta || null,
    pixel_google: c.pixelGoogle || null,
    webhook_url: c.webhookUrl || null,
    redirect_url: c.redirectUrl || null,
    scarcity_timer_minutes: c.scarcityTimerMinutes,
    secure_seal: c.secureSeal,
    urgency_message: c.urgencyMessage,
    active: c.active,
    conversion: c.conversion,
    revenue: c.revenue,
    blocks: c.blocks ?? [],
  };
}
