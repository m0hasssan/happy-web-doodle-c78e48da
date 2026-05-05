
CREATE TABLE public.manufacturing_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.section_metals (
  section_id uuid NOT NULL REFERENCES public.manufacturing_sections(id) ON DELETE CASCADE,
  metal_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (section_id, metal_id)
);

CREATE TABLE public.section_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.manufacturing_sections(id) ON DELETE CASCADE,
  metal_id uuid NOT NULL,
  karat text,
  total_weight numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manufacturing_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_metals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view sections" ON public.manufacturing_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert sections" ON public.manufacturing_sections FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update sections" ON public.manufacturing_sections FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete sections" ON public.manufacturing_sections FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view section_metals" ON public.section_metals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert section_metals" ON public.section_metals FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete section_metals" ON public.section_metals FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view section_inventory" ON public.section_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert section_inventory" ON public.section_inventory FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update section_inventory" ON public.section_inventory FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete section_inventory" ON public.section_inventory FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
