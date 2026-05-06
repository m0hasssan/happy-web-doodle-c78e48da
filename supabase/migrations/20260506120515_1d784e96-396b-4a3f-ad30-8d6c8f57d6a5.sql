
-- Add color preset key to metals
ALTER TABLE public.metals
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'gold';

-- Backfill defaults based on code
UPDATE public.metals SET color = 'gold' WHERE code = 'gold';
UPDATE public.metals SET color = 'silver' WHERE code = 'silver';
UPDATE public.metals SET color = 'copper' WHERE code = 'copper';

-- Karats per metal
CREATE TABLE IF NOT EXISTS public.metal_karats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metal_id uuid NOT NULL REFERENCES public.metals(id) ON DELETE CASCADE,
  karat text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metal_id, karat)
);

ALTER TABLE public.metal_karats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view metal_karats"
  ON public.metal_karats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert metal_karats"
  ON public.metal_karats FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete metal_karats"
  ON public.metal_karats FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
