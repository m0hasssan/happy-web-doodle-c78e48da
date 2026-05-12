ALTER TABLE public.metals ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'additional' CHECK (kind IN ('primary','additional'));
UPDATE public.metals SET kind = 'primary' WHERE code = 'gold';
UPDATE public.metals SET kind = 'additional' WHERE code <> 'gold';