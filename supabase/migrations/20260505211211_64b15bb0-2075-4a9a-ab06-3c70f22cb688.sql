-- Suppliers table
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Movements: from/to is polymorphic (vault or supplier)
CREATE TABLE public.movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('MV-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 4)),
  from_type text NOT NULL CHECK (from_type IN ('vault','supplier')),
  from_id uuid NOT NULL,
  to_type text NOT NULL CHECK (to_type IN ('vault','supplier')),
  to_id uuid NOT NULL,
  metal_id uuid NOT NULL REFERENCES public.metals(id),
  karat text,
  weight numeric NOT NULL DEFAULT 0,
  employee_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_from ON public.movements (from_type, from_id);
CREATE INDEX idx_movements_to ON public.movements (to_type, to_id);

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view movements" ON public.movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert movements" ON public.movements FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update movements" ON public.movements FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete movements" ON public.movements FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));