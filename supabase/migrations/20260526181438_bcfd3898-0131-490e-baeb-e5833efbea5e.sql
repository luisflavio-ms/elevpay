DROP POLICY IF EXISTS "Orders: public read by billing id" ON public.orders;
DROP POLICY IF EXISTS "Orders: public insert pending" ON public.orders;
REVOKE INSERT, SELECT ON public.orders FROM anon;