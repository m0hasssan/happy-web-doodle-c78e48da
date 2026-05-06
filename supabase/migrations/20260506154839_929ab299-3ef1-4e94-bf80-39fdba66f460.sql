
-- Create sequence for supplier codes
CREATE SEQUENCE IF NOT EXISTS public.suppliers_code_seq START 1;

-- Drop old default
ALTER TABLE public.suppliers ALTER COLUMN code DROP DEFAULT;

-- Set new short default like SP-0001
ALTER TABLE public.suppliers
  ALTER COLUMN code SET DEFAULT ('SP-' || lpad(nextval('public.suppliers_code_seq')::text, 4, '0'));

-- Renumber existing suppliers in created_at order
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.suppliers
)
UPDATE public.suppliers s
SET code = 'SP-' || lpad(o.rn::text, 4, '0')
FROM ordered o
WHERE s.id = o.id;

-- Advance the sequence past the highest existing number
SELECT setval(
  'public.suppliers_code_seq',
  GREATEST((SELECT count(*) FROM public.suppliers), 1)
);
