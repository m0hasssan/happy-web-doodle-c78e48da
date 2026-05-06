
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS phone;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS code text NOT NULL DEFAULT ('SP-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 4));
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_code_unique ON public.suppliers(code);
