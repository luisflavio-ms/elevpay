
-- Add amount to checkouts and backfill from product price; remove price from products
ALTER TABLE public.checkouts ADD COLUMN IF NOT EXISTS amount numeric NOT NULL DEFAULT 0;

UPDATE public.checkouts c
SET amount = COALESCE(p.price, 0)
FROM public.products p
WHERE c.product_id = p.id AND c.amount = 0;

ALTER TABLE public.products DROP COLUMN IF EXISTS price;
