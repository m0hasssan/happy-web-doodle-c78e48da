
-- ============= TABLES =============
CREATE TABLE public.recovery_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL DEFAULT ('RC-' || to_char(now(),'YYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text,1,4)),
  status text NOT NULL DEFAULT 'open',
  notes text,
  opened_by_user_id uuid,
  opened_by_name text,
  opened_shift_id uuid,
  closed_at timestamptz,
  closed_by_user_id uuid,
  closed_by_name text,
  closed_shift_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.recovery_operation_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.recovery_operations(id) ON DELETE CASCADE,
  section_id uuid NOT NULL,
  metal_id uuid NOT NULL,
  initial_loss_999 numeric NOT NULL DEFAULT 0,
  recovered_999 numeric NOT NULL DEFAULT 0,
  waste_999 numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(operation_id, section_id, metal_id)
);

CREATE INDEX idx_ros_section ON public.recovery_operation_sections(section_id);
CREATE INDEX idx_ros_operation ON public.recovery_operation_sections(operation_id);

CREATE TABLE public.recovery_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.recovery_operations(id) ON DELETE CASCADE,
  section_id uuid NOT NULL,
  metal_id uuid NOT NULL,
  weight_999 numeric NOT NULL,
  to_vault_id uuid NOT NULL,
  shift_id uuid,
  employee_name text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_re_operation ON public.recovery_entries(operation_id);
CREATE INDEX idx_re_section ON public.recovery_entries(section_id);

ALTER TABLE public.recovery_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_operation_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_entries ENABLE ROW LEVEL SECURITY;

-- View: anyone with view_recovery
CREATE POLICY "view recovery_operations" ON public.recovery_operations FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'view_recovery'::app_permission) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "view recovery_operation_sections" ON public.recovery_operation_sections FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'view_recovery'::app_permission) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "view recovery_entries" ON public.recovery_entries FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'view_recovery'::app_permission) OR has_role(auth.uid(),'admin'::app_role));

-- Manage: only via SECURITY DEFINER functions; deny direct writes (no insert/update/delete policies = denied)

-- ============= FUNCTIONS =============

-- Available 999 loss for a section = section_inventory(metal,999,null) - sum(initial - recovered - waste) for OPEN ops
CREATE OR REPLACE FUNCTION public.section_available_loss_999(p_section_id uuid, p_metal_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(
    COALESCE((SELECT total_weight FROM public.section_inventory
              WHERE section_id=p_section_id AND metal_id=p_metal_id AND karat='999' AND category_id IS NULL), 0)
    - COALESCE((SELECT SUM(ros.initial_loss_999 - ros.recovered_999 - ros.waste_999)
                FROM public.recovery_operation_sections ros
                JOIN public.recovery_operations ro ON ro.id = ros.operation_id
                WHERE ro.status='open' AND ros.section_id=p_section_id AND ros.metal_id=p_metal_id), 0)
  , 0)
$$;

REVOKE EXECUTE ON FUNCTION public.section_available_loss_999(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.section_available_loss_999(uuid, uuid) TO authenticated;

-- Open a new operation across one or more sections (per metal). For each chosen section, snapshot the available loss per metal.
CREATE OR REPLACE FUNCTION public.recovery_open(p_section_ids uuid[], p_shift_id uuid, p_employee_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op_id uuid;
  v_section uuid;
  v_metal record;
  v_avail numeric;
  v_any boolean := false;
BEGIN
  IF NOT (has_permission(auth.uid(), 'manage_recovery'::app_permission) OR has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية إدارة الاسترداد' USING ERRCODE='42501';
  END IF;
  IF p_shift_id IS NULL THEN
    RAISE EXCEPTION 'يجب وجود شيفت مفتوح' USING ERRCODE='P0001';
  END IF;
  IF p_section_ids IS NULL OR array_length(p_section_ids,1) IS NULL THEN
    RAISE EXCEPTION 'يجب اختيار قسم على الأقل' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.recovery_operations(opened_by_user_id, opened_by_name, opened_shift_id)
  VALUES (auth.uid(), p_employee_name, p_shift_id)
  RETURNING id INTO v_op_id;

  FOREACH v_section IN ARRAY p_section_ids LOOP
    -- For each metal that has 999 loss in the section, snapshot it
    FOR v_metal IN
      SELECT si.metal_id
      FROM public.section_inventory si
      WHERE si.section_id = v_section
        AND si.karat='999' AND si.category_id IS NULL AND si.total_weight > 0.0001
    LOOP
      v_avail := public.section_available_loss_999(v_section, v_metal.metal_id);
      IF v_avail > 0.0001 THEN
        INSERT INTO public.recovery_operation_sections(operation_id, section_id, metal_id, initial_loss_999)
        VALUES (v_op_id, v_section, v_metal.metal_id, v_avail);
        v_any := true;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT v_any THEN
    DELETE FROM public.recovery_operations WHERE id = v_op_id;
    RAISE EXCEPTION 'لا توجد خسيات متاحة في الأقسام المختارة' USING ERRCODE='P0001';
  END IF;

  RETURN v_op_id;
END$$;

REVOKE EXECUTE ON FUNCTION public.recovery_open(uuid[], uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recovery_open(uuid[], uuid, text) TO authenticated;

-- Add a recovery entry (creates a movement section→vault and updates the operation)
CREATE OR REPLACE FUNCTION public.recovery_add_entry(
  p_operation_id uuid,
  p_section_id uuid,
  p_metal_id uuid,
  p_weight numeric,
  p_to_vault_id uuid,
  p_shift_id uuid,
  p_employee_name text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ros record;
  v_remaining numeric;
  v_entry_id uuid;
  v_status text;
BEGIN
  IF NOT (has_permission(auth.uid(), 'manage_recovery'::app_permission) OR has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية إدارة الاسترداد' USING ERRCODE='42501';
  END IF;
  IF p_shift_id IS NULL THEN
    RAISE EXCEPTION 'يجب وجود شيفت مفتوح' USING ERRCODE='P0001';
  END IF;
  IF p_weight IS NULL OR p_weight <= 0 THEN
    RAISE EXCEPTION 'الوزن يجب أن يكون أكبر من صفر' USING ERRCODE='P0001';
  END IF;

  SELECT status INTO v_status FROM public.recovery_operations WHERE id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'العملية منتهية' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_ros FROM public.recovery_operation_sections
    WHERE operation_id=p_operation_id AND section_id=p_section_id AND metal_id=p_metal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'هذا القسم غير مدرج في عملية الاسترداد';
  END IF;

  v_remaining := v_ros.initial_loss_999 - v_ros.recovered_999;
  IF p_weight > v_remaining + 0.0001 THEN
    RAISE EXCEPTION 'الوزن المطلوب (%) أكبر من الخسية المتبقية (%)', p_weight, v_remaining USING ERRCODE='P0001';
  END IF;

  -- Create a movement section→vault for karat=999, no category. Trigger handles inventory.
  INSERT INTO public.movements(
    from_type, from_id, to_type, to_id, metal_id, karat, weight,
    category_id, count, shift_id, employee_name
  ) VALUES (
    'section', p_section_id, 'vault', p_to_vault_id, p_metal_id, '999', p_weight,
    NULL, NULL, p_shift_id, p_employee_name
  );

  UPDATE public.recovery_operation_sections
    SET recovered_999 = recovered_999 + p_weight
    WHERE id = v_ros.id;

  INSERT INTO public.recovery_entries(operation_id, section_id, metal_id, weight_999, to_vault_id, shift_id, employee_name, created_by_user_id)
  VALUES (p_operation_id, p_section_id, p_metal_id, p_weight, p_to_vault_id, p_shift_id, p_employee_name, auth.uid())
  RETURNING id INTO v_entry_id;

  UPDATE public.recovery_operations SET updated_at = now() WHERE id = p_operation_id;
  RETURN v_entry_id;
END$$;

REVOKE EXECUTE ON FUNCTION public.recovery_add_entry(uuid,uuid,uuid,numeric,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recovery_add_entry(uuid,uuid,uuid,numeric,uuid,uuid,text) TO authenticated;

-- Close operation: any unrecovered amount becomes waste, deducted from section_inventory
CREATE OR REPLACE FUNCTION public.recovery_close(p_operation_id uuid, p_shift_id uuid, p_employee_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ros record;
  v_waste numeric;
  v_inv_id uuid;
  v_existing numeric;
  v_status text;
BEGIN
  IF NOT (has_permission(auth.uid(), 'manage_recovery'::app_permission) OR has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية إدارة الاسترداد' USING ERRCODE='42501';
  END IF;

  SELECT status INTO v_status FROM public.recovery_operations WHERE id = p_operation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العملية غير موجودة'; END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'العملية منتهية بالفعل' USING ERRCODE='P0001';
  END IF;

  FOR v_ros IN
    SELECT * FROM public.recovery_operation_sections WHERE operation_id = p_operation_id FOR UPDATE
  LOOP
    v_waste := v_ros.initial_loss_999 - v_ros.recovered_999;
    IF v_waste > 0.0001 THEN
      -- Deduct waste from section_inventory 999 null
      SELECT id, total_weight INTO v_inv_id, v_existing
      FROM public.section_inventory
      WHERE section_id = v_ros.section_id AND metal_id = v_ros.metal_id AND karat='999' AND category_id IS NULL
      FOR UPDATE;
      IF NOT FOUND OR v_existing < v_waste - 0.0001 THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ في القسم لتسجيل الهالك' USING ERRCODE='P0001';
      END IF;
      UPDATE public.section_inventory
        SET total_weight = total_weight - v_waste, updated_at = now()
        WHERE id = v_inv_id;
    END IF;
    UPDATE public.recovery_operation_sections SET waste_999 = GREATEST(v_waste, 0) WHERE id = v_ros.id;
  END LOOP;

  UPDATE public.recovery_operations
    SET status='closed',
        closed_at = now(),
        closed_by_user_id = auth.uid(),
        closed_by_name = p_employee_name,
        closed_shift_id = p_shift_id,
        updated_at = now()
    WHERE id = p_operation_id;
END$$;

REVOKE EXECUTE ON FUNCTION public.recovery_close(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recovery_close(uuid,uuid,text) TO authenticated;

CREATE TRIGGER trg_recovery_operations_updated_at BEFORE UPDATE ON public.recovery_operations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
