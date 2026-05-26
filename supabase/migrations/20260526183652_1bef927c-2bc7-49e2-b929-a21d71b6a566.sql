
-- Helper de validação de URL pública (https, sem localhost/IPs privados)
CREATE OR REPLACE FUNCTION public.is_safe_public_url(u text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    u IS NULL OR (
      u ~* '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]+)?(/.*)?$'
      AND u !~* '^https?://(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|\[?::1\]?|0\.0\.0\.0)'
    )
$$;

ALTER TABLE public.checkouts
  ADD CONSTRAINT checkouts_redirect_url_safe
    CHECK (public.is_safe_public_url(redirect_url));

ALTER TABLE public.checkouts
  ADD CONSTRAINT checkouts_webhook_url_safe
    CHECK (public.is_safe_public_url(webhook_url));

ALTER TABLE public.checkouts
  ADD CONSTRAINT checkouts_pixel_meta_format
    CHECK (pixel_meta IS NULL OR pixel_meta ~ '^[0-9]{10,20}$');

ALTER TABLE public.checkouts
  ADD CONSTRAINT checkouts_pixel_google_format
    CHECK (pixel_google IS NULL OR pixel_google ~ '^(G-[A-Z0-9]{4,20}|AW-[0-9]{6,20}|GTM-[A-Z0-9]{4,20}|UA-[0-9]{4,12}-[0-9]{1,4})$');

ALTER TABLE public.webhook_configs
  ADD CONSTRAINT webhook_configs_url_safe
    CHECK (public.is_safe_public_url(url) AND url IS NOT NULL);
