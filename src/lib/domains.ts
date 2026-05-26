// Domain routing constants for production subdomain split.
// pay.elevpayapp.com.br  -> /checkout/*  (público, comprador)
// dashboard.elevpayapp.com.br -> /app, /login, etc. (administração)
//
// Em outros hosts (preview Lovable, *.lovable.app, localhost) o roteamento
// fica como está: a mesma origem serve tudo.

export const PAY_HOST = "pay.elevpayapp.com.br";
export const DASHBOARD_HOST = "dashboard.elevpayapp.com.br";

export const PAY_ORIGIN = `https://${PAY_HOST}`;
export const DASHBOARD_ORIGIN = `https://${DASHBOARD_HOST}`;

const ROOT_DOMAIN = "elevpayapp.com.br";

/** Origem a usar para gerar URL pública de checkout. */
export function checkoutOrigin(): string {
  if (typeof window === "undefined") return PAY_ORIGIN;
  const host = window.location.hostname;
  // Em produção sob o domínio próprio, sempre usar pay.*
  if (host === PAY_HOST || host === DASHBOARD_HOST || host.endsWith(`.${ROOT_DOMAIN}`)) {
    return PAY_ORIGIN;
  }
  // Preview / lovable.app / localhost: mesma origem
  return window.location.origin;
}

/** Decide se a URL atual deve ser redirecionada para o subdomínio correto. */
export function getDomainRedirect(): string | null {
  if (typeof window === "undefined") return null;
  const { hostname, pathname, search, hash } = window.location;
  const isCheckoutPath = pathname.startsWith("/checkout/") || pathname === "/checkout";

  if (hostname === PAY_HOST && !isCheckoutPath) {
    return `${DASHBOARD_ORIGIN}${pathname}${search}${hash}`;
  }
  if (hostname === DASHBOARD_HOST && isCheckoutPath) {
    return `${PAY_ORIGIN}${pathname}${search}${hash}`;
  }
  return null;
}
