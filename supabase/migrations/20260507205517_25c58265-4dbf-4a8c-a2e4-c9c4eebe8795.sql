
-- work_orders
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL DEFAULT ('WO-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 4)),
  from_vault_id uuid NOT NULL,
  to_section_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','cancelled','delivered')),
  temp_returned_to_vault boolean NOT NULL DEFAULT false,
  notes text,
  shift_id uuid,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_orders_vault ON public.work_orders(from_vault_id);
CREATE INDEX idx_work_orders_section ON public.work_orders(to_section_id);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view work_orders"
  ON public.work_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert work_orders with permission"
  ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (
    has_permission(auth.uid(), 'create_vault_entry'::app_permission, from_vault_id)
    OR has_permission(auth.uid(), 'access_section'::app_permission, to_section_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Update work_orders with permission"
  ON public.work_orders FOR UPDATE TO authenticated
  USING (
    has_permission(auth.uid(), 'create_vault_entry'::app_permission, from_vault_id)
    OR has_permission(auth.uid(), 'access_section'::app_permission, to_section_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Delete work_orders admin"
  ON public.work_orders FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- link movements -> work_orders
ALTER TABLE public.movements ADD COLUMN work_order_id uuid;
CREATE INDEX idx_movements_work_order ON public.movements(work_order_id);

-- Temp return to vault
CREATE OR REPLACE FUNCTION public.work_order_temp_return(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wo public.work_orders%ROWTYPE;
  m RECORD;
  v_id uuid;
  v_existing numeric;
BEGIN
  SELECT * INTO wo FROM public.work_orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'أمر الشغل غير موجود' USING ERRCODE='P0001'; END IF;
  IF wo.status <> 'in_progress' THEN RAISE EXCEPTION 'أمر الشغل ليس تحت التنفيذ' USING ERRCODE='P0001'; END IF;
  IF wo.temp_returned_to_vault THEN RAISE EXCEPTION 'تم استرداده مسبقاً' USING ERRCODE='P0001'; END IF;

  -- permission check
  IF NOT (
    has_permission(auth.uid(), 'create_vault_entry'::app_permission, wo.from_vault_id)
    OR has_permission(auth.uid(), 'access_section'::app_permission, wo.to_section_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'لا تملك صلاحية' USING ERRCODE='42501';
  END IF;

  FOR m IN SELECT metal_id, karat, weight FROM public.movements WHERE work_order_id = _id LOOP
    -- subtract from section
    SELECT id, total_weight INTO v_id, v_existing FROM public.section_inventory
      WHERE section_id = wo.to_section_id AND metal_id = m.metal_id AND karat IS NOT DISTINCT FROM m.karat FOR UPDATE;
    IF NOT FOUND OR v_existing < m.weight THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ في القسم لاسترداد الأمر' USING ERRCODE='P0001';
    END IF;
    UPDATE public.section_inventory SET total_weight = total_weight - m.weight, updated_at = now() WHERE id = v_id;

    -- add to vault
    SELECT id INTO v_id FROM public.vault_inventory
      WHERE vault_id = wo.from_vault_id AND metal_id = m.metal_id AND karat IS NOT DISTINCT FROM m.karat FOR UPDATE;
    IF FOUND THEN
      UPDATE public.vault_inventory SET total_weight = total_weight + m.weight, updated_at = now() WHERE id = v_id;
    ELSE
      INSERT INTO public.vault_inventory(vault_id, metal_id, karat, total_weight) VALUES (wo.from_vault_id, m.metal_id, m.karat, m.weight);
    END IF;
  END LOOP;

  UPDATE public.work_orders SET temp_returned_to_vault = true, updated_at = now() WHERE id = _id;
END$$;

-- Send back to section
CREATE OR REPLACE FUNCTION public.work_order_send_back_to_section(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wo public.work_orders%ROWTYPE;
  m RECORD;
  v_id uuid;
  v_existing numeric;
  allowed boolean;
BEGIN
  SELECT * INTO wo FROM public.work_orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'أمر الشغل غير موجود' USING ERRCODE='P0001'; END IF;
  IF wo.status <> 'in_progress' THEN RAISE EXCEPTION 'أمر الشغل ليس تحت التنفيذ' USING ERRCODE='P0001'; END IF;
  IF NOT wo.temp_returned_to_vault THEN RAISE EXCEPTION 'الأمر ليس مسترداً للخزنة' USING ERRCODE='P0001'; END IF;

  IF NOT (
    has_permission(auth.uid(), 'create_vault_entry'::app_permission, wo.from_vault_id)
    OR has_permission(auth.uid(), 'access_section'::app_permission, wo.to_section_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'لا تملك صلاحية' USING ERRCODE='42501';
  END IF;

  FOR m IN SELECT metal_id, karat, weight FROM public.movements WHERE work_order_id = _id LOOP
    -- ensure section still accepts metal
    SELECT EXISTS(SELECT 1 FROM public.section_metals WHERE section_id = wo.to_section_id AND metal_id = m.metal_id) INTO allowed;
    IF NOT allowed THEN RAISE EXCEPTION 'القسم لا يقبل أحد المعادن المستردة' USING ERRCODE='P0001'; END IF;

    -- subtract from vault
    SELECT id, total_weight INTO v_id, v_existing FROM public.vault_inventory
      WHERE vault_id = wo.from_vault_id AND metal_id = m.metal_id AND karat IS NOT DISTINCT FROM m.karat FOR UPDATE;
    IF NOT FOUND OR v_existing < m.weight THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ في الخزنة لإعادة الأمر' USING ERRCODE='P0001';
    END IF;
    UPDATE public.vault_inventory SET total_weight = total_weight - m.weight, updated_at = now() WHERE id = v_id;

    -- add to section
    SELECT id INTO v_id FROM public.section_inventory
      WHERE section_id = wo.to_section_id AND metal_id = m.metal_id AND karat IS NOT DISTINCT FROM m.karat FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_inventory SET total_weight = total_weight + m.weight, updated_at = now() WHERE id = v_id;
    ELSE
      INSERT INTO public.section_inventory(section_id, metal_id, karat, total_weight) VALUES (wo.to_section_id, m.metal_id, m.karat, m.weight);
    END IF;
  END LOOP;

  UPDATE public.work_orders SET temp_returned_to_vault = false, updated_at = now() WHERE id = _id;
END$$;
