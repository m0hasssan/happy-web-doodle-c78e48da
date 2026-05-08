ALTER TABLE public.manufacturing_sections
ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'manufacturing';

CREATE INDEX IF NOT EXISTS idx_manufacturing_sections_kind ON public.manufacturing_sections(kind);