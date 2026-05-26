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

/**
 * Decide se a URL atual deve ser redirecionada para o subdomínio correto.
 *
 * IMPORTANTE: desativado. O hosting (Lovable) está configurado com um
 * subdomínio primário que redireciona o outro via 30x no servidor. Se o
 * client também forçar redirect entre pay/dashboard, criamos um loop
 * infinito (server manda pra A, client manda pra B, server manda pra A...).
 *
 * As rotas funcionam em qualquer um dos dois hosts, então simplesmente
 * não redirecionamos no client. `checkoutOrigin()` continua usando
 * `pay.*` para gerar links públicos.
 */
export function getDomainRedirect(): string | null {
  return null;
}
