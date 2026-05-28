
CREATE OR REPLACE FUNCTION public.get_public_checkout(p_public_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    SELECT p.id, p.name, p.description, p.image, p.type, p.delivery_url
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
$$;

REVOKE ALL ON FUNCTION public.get_public_checkout(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_checkout(text) TO anon, authenticated;
