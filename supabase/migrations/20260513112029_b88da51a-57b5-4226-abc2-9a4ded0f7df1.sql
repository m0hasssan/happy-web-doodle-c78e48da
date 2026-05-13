ALTER TABLE public.movements
  DROP CONSTRAINT IF EXISTS movements_from_type_check,
  DROP CONSTRAINT IF EXISTS movements_to_type_check;

ALTER TABLE public.movements
  ADD CONSTRAINT movements_from_type_check
    CHECK (from_type = ANY (ARRAY['vault'::text, 'supplier'::text, 'section'::text, 'adjustment'::text, 'shrinkage'::text])),
  ADD CONSTRAINT movements_to_type_check
    CHECK (to_type = ANY (ARRAY['vault'::text, 'supplier'::text, 'section'::text, 'adjustment'::text, 'shrinkage'::text]));