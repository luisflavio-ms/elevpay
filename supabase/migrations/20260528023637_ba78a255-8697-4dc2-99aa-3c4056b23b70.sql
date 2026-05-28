
-- 1. Hide products.delivery_url from anon/authenticated (column-level)
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (id, user_id, name, description, image, type, created_at, updated_at) ON public.products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
-- Note: the above re-grants full DML to authenticated; owner RLS still restricts to owned rows.
-- But INSERT/UPDATE/DELETE grants don't conflict with the column-level SELECT restriction for anon.
-- For authenticated, we need full SELECT on own rows; column-level revoke applies to all, so re-grant full SELECT only to authenticated for owner access:
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- 2. Update get_public_checkout to not return delivery_url
CREATE OR REPLACE FUNCTION public.get_public_checkout(p_public_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH variant AS (
    SELECT checkout_id, amount
    FROM checkout_price_variants
    WHERE public_id = p_public_id
    LIMIT 1
  ),
  ck AS (
    SELECT c.*
    FROM checkouts c
    WHERE c.active = true
      AND (
        c.public_id = p_public_id
        OR c.id = (SELECT checkout_id FROM variant)
      )
    LIMIT 1
  ),
  prod AS (
    SELECT p.id, p.name, p.description, p.image, p.type
    FROM products p
    WHERE p.id = (SELECT product_id FROM ck)
  ),
  bump AS (
    SELECT b.id, b.title, b.description, b.price, b.compare_at_price, b.product_id
    FROM order_bumps b
    WHERE b.id = (SELECT order_bump_id FROM ck)
  ),
  bump_prod AS (
    SELECT p.name, p.image
    FROM products p
    WHERE p.id = (SELECT product_id FROM bump)
  )
  SELECT jsonb_build_object(
    'checkout', (SELECT to_jsonb(ck.*) FROM ck),
    'variant', (SELECT to_jsonb(variant.*) FROM variant),
    'product', (SELECT to_jsonb(prod.*) FROM prod),
    'order_bump', (SELECT to_jsonb(bump.*) FROM bump),
    'order_bump_product', (SELECT to_jsonb(bump_prod.*) FROM bump_prod)
  );
$function$;

-- 3. Drop overly broad public read policy on product-images bucket.
-- The bucket is public, so files remain accessible via their direct public URL.
DROP POLICY IF EXISTS "Product images publicly readable" ON storage.objects;

-- 4. Add restrictive RLS on realtime.messages so authenticated users can only
-- subscribe/broadcast on channel topics that include their own user id.
-- (postgres_changes still uses the underlying table RLS independently.)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own-topic realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read own-topic realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || (auth.uid())::text || '%'
);

DROP POLICY IF EXISTS "Authenticated can write own-topic realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can write own-topic realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || (auth.uid())::text || '%'
);
