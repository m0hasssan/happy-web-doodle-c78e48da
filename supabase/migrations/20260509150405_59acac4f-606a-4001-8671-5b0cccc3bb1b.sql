
-- Step 1: Convert all processing sections to manufacturing
UPDATE public.manufacturing_sections SET kind = 'manufacturing' WHERE kind = 'processing';

-- Step 2: Section settings table (toggles)
CREATE TABLE IF NOT EXISTS public.section_settings (
  section_id uuid PRIMARY KEY REFERENCES public.manufacturing_sections(id) ON DELETE CASCADE,
  allow_karat_change boolean NOT NULL DEFAULT true,
  allow_category_change boolean NOT NULL DEFAULT true,
  allow_count_change boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.section_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view section_settings" ON public.section_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert section_settings with permission" ON public.section_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'edit_section', section_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update section_settings with permission" ON public.section_settings FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_section', section_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete section_settings with permission" ON public.section_settings FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_section', section_id) OR public.has_role(auth.uid(), 'admin'));

-- Backfill defaults
INSERT INTO public.section_settings (section_id)
SELECT id FROM public.manufacturing_sections
ON CONFLICT (section_id) DO NOTHING;

-- Step 3: Section metal/karat rules table
CREATE TABLE IF NOT EXISTS public.section_metal_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.manufacturing_sections(id) ON DELETE CASCADE,
  metal_id uuid NOT NULL,
  karat text,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS section_metal_rules_uniq
  ON public.section_metal_rules (section_id, metal_id, COALESCE(karat,''), direction);

ALTER TABLE public.section_metal_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view section_metal_rules" ON public.section_metal_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert section_metal_rules with permission" ON public.section_metal_rules FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'edit_section', section_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "update section_metal_rules with permission" ON public.section_metal_rules FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_section', section_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete section_metal_rules with permission" ON public.section_metal_rules FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_section', section_id) OR public.has_role(auth.uid(), 'admin'));

-- Step 4: Update trigger to auto-create timestamp
CREATE TRIGGER trg_section_settings_updated_at
  BEFORE UPDATE ON public.section_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
