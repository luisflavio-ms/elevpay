ALTER TABLE public.order_bumps ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE public.order_bumps ADD COLUMN IF NOT EXISTS compare_at_price numeric;
ALTER TABLE public.order_bumps ALTER COLUMN title DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_bumps_product_id ON public.order_bumps(product_id);