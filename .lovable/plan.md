
# Plano: Checkout ultra-rápido

Hoje a página `/checkout/$publicId` faz fetch duplicado (loader + useEffect), carrega tudo de uma vez (push, polling, BlockRenderer) e a imagem do produto é `loading="lazy"` mesmo sendo LCP. Vamos atacar isso em camadas, da que mais impacta para a que menos impacta.

## 1. Eliminar o duplo fetch (maior ganho)

Hoje o `loader` já busca variant + checkout + produto, mas o componente refaz **tudo de novo** em `useEffect`, com queries sequenciais. Isso atrasa o primeiro render em 1–3 segundos.

- Expandir o `loader` para retornar o objeto completo (`{ c, p, b, priceOverride }`) já mapeado com `rowToCheckout`.
- Trocar as duas queries sequenciais (variant → checkout) por uma única **RPC** `get_checkout_by_public_id(public_id)` no banco que faz o lookup em variant + checkout + product + order_bump em uma só ida ao Postgres.
- No componente, ler com `Route.useLoaderData()` e remover o `useEffect` de fetch. O `loading` skeleton só aparece em navegação client-side.

## 2. SSR + cache de borda

- Marcar a rota como SSR (já é por padrão no TanStack Start) e adicionar header `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` na resposta do loader via `setResponseHeaders`. Checkout muda raramente; servir do edge faz o HTML chegar em <100ms mundo todo.
- Como o preço pode mudar, invalidar manualmente via versioning do `public_id` ou reduzir o `s-maxage` para 30s.

## 3. LCP da imagem do produto

A imagem hero está com `loading="lazy"` — isso atrasa o LCP de propósito. Vamos:
- Trocar para `loading="eager"` + `fetchpriority="high"` + `decoding="async"`.
- Adicionar `<link rel="preload" as="image" href={c.image} fetchpriority="high">` no `head()` do loader, derivado dos dados já carregados.
- Adicionar `width`/`height` (ou usar `aspect-ratio` como já está) para evitar CLS.

## 4. Code-splitting de coisas não-críticas

Tudo isto carrega no bundle inicial mesmo que o comprador nem chegue a usar:
- `getVapidPublicKey`, `subscribePush`, `urlBase64ToUint8Array` → mover para dynamic `import()` dentro de `enablePushForOrder`, executado só depois do PIX gerado.
- `checkOrderStatus` polling → já é só após gerar PIX, ok.
- `BlockRenderer` → `React.lazy` + `<Suspense>` para não bloquear o primeiro paint dos blocos `position: "above"` quando não existirem; quando existirem, ainda assim sai do bundle principal e carrega em paralelo.

## 5. Preconnect e prefetch

No `head()` do loader, adicionar:
```
<link rel="preconnect" href="https://uhtrywhkpczlekzyywkk.supabase.co" crossorigin>
<link rel="dns-prefetch" href="https://api.abacatepay.com">
```
Assim a conexão TLS para gerar o PIX já está aberta quando o usuário clicar em "Pagar".

## 6. Reduzir trabalho no thread principal

- Remover `useEffect` que atualiza `document.title` (já temos `head()` no loader, é redundante).
- Substituir os `style={{ ... }}` inline mais pesados por classes Tailwind para evitar recriação de objetos a cada render.
- Garantir que o `setInterval` de timer (`secondsLeft`) só monta quando `c.scarcityTimerMinutes > 0`.

## 7. Service worker para repeat-visitors

O `public/sw.js` existe (para push). Adicionar precache do shell HTML de `/checkout/$publicId` com strategy stale-while-revalidate. Segunda visita do mesmo comprador (que abandonou e voltou) abre instantaneamente.

## Detalhes técnicos

- Migration nova: função SQL `public.get_checkout_by_public_id(p_public_id text)` retornando `jsonb` com checkout + product + order_bump. `SECURITY DEFINER`, `STABLE`, grant `EXECUTE` para `anon` e `authenticated` (checkout é público).
- Em `src/routes/checkout.$publicId.tsx`: substituir os dois fetches por uma chamada `supabase.rpc('get_checkout_by_public_id', { p_public_id: publicId })` dentro do loader; manter o `try/catch` que retorna `{ meta: null }`.
- `head()` recebe `loaderData` já com `image`, então o `<link rel="preload" as="image">` sai gratuito.
- `BlockRenderer` vira `const BlockRenderer = lazy(() => import("@/components/checkout/BlockRenderer"))` com `<Suspense fallback={null}>`.

## Ordem de execução sugerida

1. RPC + loader unificado + remover useEffect de fetch (impacto enorme).
2. Preload LCP + eager image (impacto alto, trivial).
3. Preconnect headers (impacto médio, trivial).
4. Code-split push/BlockRenderer (impacto médio).
5. Cache de borda (impacto alto, requer cuidado com invalidação).
6. SW precache (impacto só em retorno).

## Fora de escopo

- Não vamos mudar visual do checkout.
- Não vamos mexer no fluxo de pagamento PIX em si.
- Não vamos remover o polling de status (necessário).

Posso seguir nessa ordem ou você prefere que eu faça só os passos 1–4 primeiro e a gente mede antes de mexer em cache/SW?
