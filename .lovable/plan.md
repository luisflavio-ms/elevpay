## Hardening de segurança — escopo aprovado (P0 + P1)

A migração de validação já rodou (CHECK constraints em `checkouts.redirect_url`, `webhook_url`, `pixel_meta`, `pixel_google` e em `webhook_configs.url`). Restam as mudanças de código abaixo.

### Remoções
- Apagar `src/routes/api/public/test-push.ts` (endpoint de debug).
- Remover `simulatePixPayment` de `src/lib/abacate.functions.ts` e a importação/uso em `src/routes/checkout.$publicId.tsx` (botão "Simular" do modal).

### Webhook Abacate (`/api/public/abacate-webhook`)
- Aceitar o secret via header `x-webhook-secret` em vez de querystring.
- Comparar com `crypto.timingSafeEqual` para evitar timing attack.
- Manter compatibilidade temporária aceitando ainda `?webhookSecret=` (a remover depois que o painel da Abacate for atualizado).

### Server functions de checkout
- `createPixPayment`: antes de chamar a Abacate, rejeitar se já existir pedido `pendente` para o mesmo `checkout_id` + `customer_document` criado nos últimos 30 segundos. Reduz flood/duplicidade.
- `checkOrderStatus`: continuar retornando apenas `{status}` (já é o caso) e tratar erros silenciosamente sem expor IDs.
- Logs sanitizados: mascarar `customer_email` e `customer_document` em `console.error`.

### Validação client-side de URLs/pixels
- Em `src/routes/app.checkouts.\$id.tsx` e `app.webhooks.tsx`, validar com Zod no submit (`https://`, sem hosts privados, regex de pixels) — mensagens amigáveis antes do erro do banco.

### Security headers globais
- Adicionar `securityHeadersMiddleware` em `src/start.ts` (`requestMiddleware`) que injeta nas respostas:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `X-Frame-Options: DENY` por padrão (rotas `/checkout/*` recebem `SAMEORIGIN` para permitir incorporação se necessário)
  - CSP base: `default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' https://www.googletagmanager.com https://connect.facebook.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://api.abacatepay.com https://www.google-analytics.com https://www.facebook.com; frame-ancestors 'none'`

### Mascarar PII no dashboard
- Em listagens de pedidos/vendas, exibir CPF como `***.***.***-12` por padrão; e-mail como `a***@dominio`; clique em "ver" revela o valor completo (apenas para o owner — RLS já garante).

### Supabase Auth
- Chamar `configure_auth({ password_hibp_enabled: true, auto_confirm_email: false, disable_signup: false, external_anonymous_users_enabled: false })` para ativar verificação contra HaveIBeenPwned e desligar sign-ups anônimos.

### Memória de segurança
- Atualizar `mem://` security memory com: webhook por header, simulate removido, headers globais, validação de URL/pixel, HIBP.

### Arquivos afetados
- delete: `src/routes/api/public/test-push.ts`
- edit: `src/lib/abacate.functions.ts`, `src/routes/checkout.$publicId.tsx`, `src/routes/api/public/abacate-webhook.ts`, `src/start.ts`, `src/routes/app.checkouts.$id.tsx`, `src/routes/app.webhooks.tsx`, telas de pedidos/vendas
- config: `supabase--configure_auth`

Após implementar, vou rodar o linter/scan de segurança e marcar findings resolvidos.