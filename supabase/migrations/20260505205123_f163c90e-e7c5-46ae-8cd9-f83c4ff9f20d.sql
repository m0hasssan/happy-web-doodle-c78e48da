
-- METALS
CREATE TABLE public.metals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.metals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view metals" ON public.metals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage metals insert" ON public.metals
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage metals update" ON public.metals
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage metals delete" ON public.metals
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER update_metals_updated_at BEFORE UPDATE ON public.metals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VAULTS
CREATE TABLE public.vaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vaults" ON public.vaults
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert vaults" ON public.vaults
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update vaults" ON public.vaults
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete vaults" ON public.vaults
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER update_vaults_updated_at BEFORE UPDATE ON public.vaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VAULT_METALS (which metals a vault accepts)
CREATE TABLE public.vault_metals (
  vault_id uuid NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
  metal_id uuid NOT NULL REFERENCES public.metals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vault_id, metal_id)
);

ALTER TABLE public.vault_metals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view vault_metals" ON public.vault_metals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert vault_metals" ON public.vault_metals
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete vault_metals" ON public.vault_metals
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- VAULT_INVENTORY (total weight per metal per vault)
CREATE TABLE public.vault_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
  metal_id uuid NOT NULL REFERENCES public.metals(id) ON DELETE CASCADE,
  total_weight numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vault_id, metal_id)
);

ALTER TABLE public.vault_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view vault_inventory" ON public.vault_inventory
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert vault_inventory" ON public.vault_inventory
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update vault_inventory" ON public.vault_inventory
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete vault_inventory" ON public.vault_inventory
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER update_vault_inventory_updated_at BEFORE UPDATE ON public.vault_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED
INSERT INTO public.metals (code, name_ar) VALUES
  ('gold','ذهب'),
  ('silver','فضة'),
  ('copper','نحاس');

WITH new_vaults AS (
  INSERT INTO public.vaults (name) VALUES
    ('الخزنة الرئيسية'),
    ('خزنة الخواجة')
  RETURNING id
)
INSERT INTO public.vault_metals (vault_id, metal_id)
SELECT v.id, m.id FROM new_vaults v CROSS JOIN public.metals m;
