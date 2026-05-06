-- Metal categories (e.g. سبائك / مشغولات / كسر) per metal
CREATE TABLE public.metal_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metal_id uuid NOT NULL REFERENCES public.metals(id) ON DELETE CASCADE,
  name text NOT NULL,
  requires_count boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metal_id, name)
);

ALTER TABLE public.metal_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view metal_categories"
  ON public.metal_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert metal_categories"
  ON public.metal_categories FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update metal_categories"
  ON public.metal_categories FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete metal_categories"
  ON public.metal_categories FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_metal_categories_updated
  BEFORE UPDATE ON public.metal_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add category + count to movements (nullable to keep existing rows valid)
ALTER TABLE public.movements
  ADD COLUMN category_id uuid REFERENCES public.metal_categories(id) ON DELETE SET NULL,
  ADD COLUMN count integer;
