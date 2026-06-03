## Findings (24 no total)

**Críticos (error):**
1. `checkouts` policy `public read ativos` expõe a TODO anônimo colunas sensíveis (`webhook_url`, `redirect_url`, `pixel_meta`, `pixel_google`, `revenue`, `conversion`).
2. Open redirect em `src/routes/login.tsx` — `search.redirect` aceita URL absoluta arbitrária.

**Avisos:**
3. 5 funções SECURITY DEFINER sem `search_path` (`delete_email`, `enqueue_email`, `move_to_dlq`, `read_email_batch`, e revisão das demais).
4. 13 funções SECURITY DEFINER com `EXECUTE` para `public`/`anon`/`authenticated` (devem ficar restritas a `service_role` exceto `get_public_checkout` e `has_role`).
5. Realtime em `orders` — verificar que assinatura usa JWT autenticado (já usa, mas reforçar).
6. `orders` sem policy INSERT explícita (inserts só ocorrem via `service_role`).
7. `checkOrderStatus` sem auth + race condition que pode duplicar `sales`.

## Mudanças

### 1) Migração SQL (uma única migração)

- **`SET search_path = public`** em: `delete_email`, `enqueue_email`, `move_to_dlq`, `read_email_batch`.
- **Revogar EXECUTE de `public`** em todas as funções `SECURITY DEFINER` e conceder apenas onde necessário:
  - `get_public_checkout(text)` → `GRANT EXECUTE TO anon, authenticated` (RPC pública intencional).
  - `has_role(uuid, app_role)` → `GRANT EXECUTE TO authenticated` (usada em policies).
  - `handle_new_user()` → trigger, só `service_role`.
  - `delete_email`, `enqueue_email`, `move_to_dlq`, `read_email_batch` → apenas `service_role` (chamadas por jobs server-side).
- **Substituir policy `Checkouts: public read ativos`** por uma versão restrita a colunas seguras. Como Postgres RLS não filtra colunas, criar **view `public_checkouts`** com SECURITY INVOKER (sem `webhook_url`, `redirect_url`, `pixel_meta`, `pixel_google`, `revenue`, `conversion`, `user_id` cru) e remover a policy anon na tabela `checkouts`. Manter acesso direto somente via `get_public_checkout` (já existente) e via a view se algum caller precisar.
  - Revogar `SELECT` de `anon` em `public.checkouts`.
  - Conceder `SELECT` em `public.public_checkouts` para `anon, authenticated`.
- **Policy INSERT explícita "deny" em `orders`** para `anon` (defesa em profundidade — apenas `service_role` insere).
- **Unique constraint em `sales(order_id)`** para impedir duplicação de venda mesmo sob race condition.

### 2) `src/routes/login.tsx`

- Adicionar helper `isSafeRelativePath(s)` (deve começar com `/` e não com `//`).
- `searchSchema.redirect` → `.refine(isSafeRelativePath)` com `.catch(undefined)`.
- Usar valor validado em `beforeLoad` e `onSubmit`; fallback `/app/dashboard`.

### 3) `src/lib/abacate.functions.ts` — `checkOrderStatus`

- Antes do `insert` em `sales`, usar **update condicional** em `orders` (`.eq('status', 'pendente')`) e checar `count`; se 0, outro caller já transicionou — retornar sem efeitos colaterais.
- A unique constraint em `sales.order_id` é a rede de segurança final.
- Mesma blindagem (defensiva) no webhook `abacate-webhook.ts` (já tem checagem `order.status === newStatus` mas adicionar update condicional).

### 4) Verificações sem mudança de código

- Realtime `orders`: o cliente em `AppLayout.tsx` já chama `supabase.auth.getUser()` antes de subscrever e usa filtro `user_id=eq.${uid}` com sessão autenticada. RLS na tabela protege `postgres_changes`. **Documentar em security-memory** que anon não tem acesso à tabela `orders`.

### 5) Atualizar security-memory

Registrar:
- `get_public_checkout` é a única RPC pública intencional; retorna apenas campos seguros.
- `public_checkouts` view: alternativa de leitura pública sem campos sensíveis.
- `orders` é estritamente server-side via `service_role`; nunca exposta a anon.
- `sales.order_id` unique → idempotência financeira.

### 6) Marcar findings como `mark_as_fixed` no scanner

Após a migração e código aplicados.

## Detalhes técnicos

```sql
-- view pública minimalista (apenas campos de renderização)
CREATE OR REPLACE VIEW public.public_checkouts
WITH (security_invoker = true) AS
SELECT id, public_id, name, headline, subheadline, image, benefits,
       testimonials, guarantee, primary_color, button_text, payment_methods,
       amount, scarcity_timer_minutes, secure_seal, urgency_message,
       blocks, product_id, order_bump_id, active
FROM public.checkouts
WHERE active = true;

GRANT SELECT ON public.public_checkouts TO anon, authenticated;

-- remove leitura anon direta à tabela
DROP POLICY "Checkouts: public read ativos" ON public.checkouts;

-- idempotência financeira
ALTER TABLE public.sales ADD CONSTRAINT sales_order_id_unique UNIQUE (order_id);

-- search_path nas funções faltantes
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- revogar EXECUTE público e restringir
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint),
                          public.enqueue_email(text, jsonb),
                          public.move_to_dlq(text, text, bigint, jsonb),
                          public.read_email_batch(text, integer, integer),
                          public.handle_new_user(),
                          public.has_role(uuid, app_role),
                          public.get_public_checkout(text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_checkout(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint),
                          public.enqueue_email(text, jsonb),
                          public.move_to_dlq(text, text, bigint, jsonb),
                          public.read_email_batch(text, integer, integer)
  TO service_role;
```

> Observação: se algum lugar do código consome `checkouts` direto pelo client (não vi nenhum — leitura pública usa `get_public_checkout`), ajustaremos para a view. Vou validar no momento da implementação.

## Riscos

- **View `public_checkouts`**: se algum cliente anon ainda fizer `from("checkouts").select()`, vai parar de funcionar. Validarei buscando no código antes de aplicar.
- **Unique em `sales.order_id`**: se já houver duplicatas históricas, a migração falha. Vou checar com SELECT antes.
