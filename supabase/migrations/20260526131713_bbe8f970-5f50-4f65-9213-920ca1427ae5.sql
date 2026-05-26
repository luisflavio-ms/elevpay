CREATE OR REPLACE FUNCTION public.gen_short_id(len int DEFAULT 10)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..len LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gen_short_id(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gen_short_id(int) TO service_role;