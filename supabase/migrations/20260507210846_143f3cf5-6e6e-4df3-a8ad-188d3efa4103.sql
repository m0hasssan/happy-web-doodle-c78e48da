ALTER TABLE public.movements DROP CONSTRAINT movements_to_type_check;
ALTER TABLE public.movements DROP CONSTRAINT movements_from_type_check;
ALTER TABLE public.movements ADD CONSTRAINT movements_to_type_check CHECK (to_type = ANY (ARRAY['vault'::text, 'supplier'::text, 'section'::text]));
ALTER TABLE public.movements ADD CONSTRAINT movements_from_type_check CHECK (from_type = ANY (ARRAY['vault'::text, 'supplier'::text, 'section'::text]));