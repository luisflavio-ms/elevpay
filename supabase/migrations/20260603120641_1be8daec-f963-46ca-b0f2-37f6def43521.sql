
-- 1) search_path nas funções faltantes
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 2) Restringir EXECUTE de funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_public_checkout(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_checkout(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;

-- 3) Remover leitura pública direta na tabela checkouts (expõe webhook_url, pixels, etc.)
DROP POLICY IF EXISTS "Checkouts: public read ativos" ON public.checkouts;
REVOKE SELECT ON public.checkouts FROM anon;

-- 4) View pública minimalista para storefront (apenas campos seguros)
CREATE OR REPLACE VIEW public.public_checkouts
WITH (security_invoker = true) AS
SELECT id, public_id, name, headline, subheadline, image, benefits,
       testimonials, guarantee, primary_color, button_text, payment_methods,
       amount, scarcity_timer_minutes, secure_seal, urgency_message,
       blocks, product_id, order_bump_id, active
FROM public.checkouts
WHERE active = true;

GRANT SELECT ON public.public_checkouts TO anon, authenticated;

-- 5) Idempotência financeira: impedir duplicação de sales por order
ALTER TABLE public.sales ADD CONSTRAINT sales_order_id_unique UNIQUE (order_id);
