-- =====================================================================
-- Policies extras: permite a página pública /checkout/:slug ler o
-- produto e o order_bump VINCULADOS a um checkout ativo.
-- Rode no SQL Editor APÓS supabase-schema.sql.
-- =====================================================================

create policy "Products: public read se referenciado por checkout ativo"
  on public.products
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.checkouts c
      where c.product_id = products.id and c.active = true
    )
  );

create policy "OrderBumps: public read se referenciado por checkout ativo"
  on public.order_bumps
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.checkouts c
      where c.order_bump_id = order_bumps.id and c.active = true
    )
  );
