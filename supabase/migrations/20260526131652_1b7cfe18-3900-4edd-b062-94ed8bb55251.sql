-- Função para gerar IDs curtos alfanuméricos (10 chars, lowercase + dígitos)
CREATE OR REPLACE FUNCTION public.gen_short_id(len int DEFAULT 10)
RETURNS text
LANGUAGE plpgsql
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

-- 1) Adiciona public_id nos checkouts
ALTER TABLE public.checkouts ADD COLUMN public_id text;

-- Backfill com tentativas até não colidir
DO $$
DECLARE
  r record;
  candidate text;
BEGIN
  FOR r IN SELECT id FROM public.checkouts WHERE public_id IS NULL LOOP
    LOOP
      candidate := public.gen_short_id(10);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.checkouts WHERE public_id = candidate);
    END LOOP;
    UPDATE public.checkouts SET public_id = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.checkouts ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE public.checkouts ADD CONSTRAINT checkouts_public_id_key UNIQUE (public_id);
ALTER TABLE public.checkouts ALTER COLUMN public_id SET DEFAULT public.gen_short_id(10);

-- Remove slug
ALTER TABLE public.checkouts DROP COLUMN IF EXISTS slug;

-- 2) Tabela de variações de preço
CREATE TABLE public.checkout_price_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT public.gen_short_id(10),
  checkout_id uuid NOT NULL REFERENCES public.checkouts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX checkout_price_variants_checkout_id_idx ON public.checkout_price_variants(checkout_id);
CREATE INDEX checkout_price_variants_user_id_idx ON public.checkout_price_variants(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkout_price_variants TO authenticated;
GRANT SELECT ON public.checkout_price_variants TO anon;
GRANT ALL ON public.checkout_price_variants TO service_role;

ALTER TABLE public.checkout_price_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Variants: owner all"
ON public.checkout_price_variants
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Variants: public read via active checkout"
ON public.checkout_price_variants
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.checkouts c
  WHERE c.id = checkout_price_variants.checkout_id AND c.active = true
));

CREATE TRIGGER set_updated_at_variants
BEFORE UPDATE ON public.checkout_price_variants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();