
-- 1) Allow 'waste' as a movement destination
ALTER TABLE public.movements DROP CONSTRAINT IF EXISTS movements_to_type_check;
ALTER TABLE public.movements ADD CONSTRAINT movements_to_type_check
  CHECK (to_type = ANY (ARRAY['vault','supplier','section','adjustment','shrinkage','waste']));

-- 2) recovery_entries: nullable operation_id, add movement_id link
ALTER TABLE public.recovery_entries ALTER COLUMN operation_id DROP NOT NULL;
ALTER TABLE public.recovery_entries ADD COLUMN IF NOT EXISTS movement_id uuid;

-- 3) Update destination-metal validation to skip 'waste'
CREATE OR REPLACE FUNCTION public.movements_validate_destination_metal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE allowed boolean;
BEGIN
  IF NEW.to_type = 'vault' THEN
    SELECT EXISTS(SELECT 1 FROM public.vault_metals WHERE vault_id = NEW.to_id AND metal_id = NEW.metal_id) INTO allowed;
    IF NOT allowed THEN RAISE EXCEPTION 'الخزنة الوجهة لا تقبل هذا المعدن' USING ERRCODE='P0001'; END IF;
  END IF;
  IF NEW.to_type = 'section' THEN
    SELECT EXISTS(SELECT 1 FROM public.section_metals WHERE section_id = NEW.to_id AND metal_id = NEW.metal_id) INTO allowed;
    IF NOT allowed THEN RAISE EXCEPTION 'القسم الوجهة لا تقبل هذا المعدن' USING ERRCODE='P0001'; END IF;
  END IF;
  RETURN NEW;
END$function$;

-- 4) Update apply_movement_inventory to handle to_type='waste' (no destination inventory effect; from_type='shrinkage' branch still deducts)
-- We just need to ensure no insert into vault/section/shrinkage inventory happens when to_type='waste'.
-- The existing function already only acts on known to_types, so adding 'waste' to the constraint is sufficient
-- because no IF branch handles it. No function change needed for apply_movement_inventory.

-- Same for reverse_movement_inventory: existing function does nothing for unknown to_types. No change needed.

-- 5) Update recovery_quick_entry to also record a recovery_entries row linked to the movement
CREATE OR REPLACE FUNCTION public.recovery_quick_entry(p_section_id uuid, p_metal_id uuid, p_karat text, p_weight numeric, p_to_vault_id uuid, p_shift_id uuid, p_employee_name text, p_category_id uuid DEFAULT NULL::uuid, p_count integer DEFAULT NULL::integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_karat_num numeric;
  v_pure999 numeric;
  v_existing numeric;
  v_movement_id uuid;
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
  IF p_karat IS NULL OR btrim(p_karat) = '' THEN
    RAISE EXCEPTION 'يجب اختيار العيار' USING ERRCODE='P0001';
  END IF;

  BEGIN v_karat_num := p_karat::numeric;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'العيار غير صحيح: %', p_karat USING ERRCODE='P0001';
  END;
  IF v_karat_num <= 0 OR v_karat_num > 999 THEN
    RAISE EXCEPTION 'العيار يجب أن يكون بين 1 و 999' USING ERRCODE='P0001';
  END IF;

  v_pure999 := round((p_weight * v_karat_num / 999.0)::numeric, 4);

  SELECT total_weight INTO v_existing
  FROM public.section_shrinkage_inventory
  WHERE section_id = p_section_id AND metal_id = p_metal_id;
  IF NOT FOUND OR COALESCE(v_existing,0) < v_pure999 - 0.0001 THEN
    RAISE EXCEPTION 'رصيد الخسية غير كافٍ في القسم (المتاح: % جم 999, المطلوب: % جم 999)', COALESCE(v_existing,0), v_pure999 USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.movements(
    from_type, from_id, to_type, to_id, metal_id, karat, weight,
    category_id, count, shift_id, employee_name, created_by_user_id
  ) VALUES (
    'shrinkage', p_section_id, 'vault', p_to_vault_id, p_metal_id, p_karat, p_weight,
    p_category_id, p_count, p_shift_id, p_employee_name, auth.uid()
  ) RETURNING id INTO v_movement_id;

  INSERT INTO public.recovery_entries(
    operation_id, section_id, metal_id, weight_999, to_vault_id,
    shift_id, employee_name, created_by_user_id, is_waste, movement_id
  ) VALUES (
    NULL, p_section_id, p_metal_id, v_pure999, p_to_vault_id,
    p_shift_id, p_employee_name, auth.uid(), false, v_movement_id
  );

  RETURN v_movement_id;
END$function$;

-- 6) Update recovery_add_entry to link movement_id
CREATE OR REPLACE FUNCTION public.recovery_add_entry(p_operation_id uuid, p_section_id uuid, p_metal_id uuid, p_weight numeric, p_to_vault_id uuid, p_shift_id uuid, p_employee_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ros record;
  v_remaining numeric;
  v_entry_id uuid;
  v_status text;
  v_movement_id uuid;
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

  INSERT INTO public.movements(
    from_type, from_id, to_type, to_id, metal_id, karat, weight,
    category_id, count, shift_id, employee_name
  ) VALUES (
    'shrinkage', p_section_id, 'vault', p_to_vault_id, p_metal_id, '999', p_weight,
    NULL, NULL, p_shift_id, p_employee_name
  ) RETURNING id INTO v_movement_id;

  UPDATE public.recovery_operation_sections
    SET recovered_999 = recovered_999 + p_weight
    WHERE id = v_ros.id;

  INSERT INTO public.recovery_entries(operation_id, section_id, metal_id, weight_999, to_vault_id, shift_id, employee_name, created_by_user_id, movement_id)
  VALUES (p_operation_id, p_section_id, p_metal_id, p_weight, p_to_vault_id, p_shift_id, p_employee_name, auth.uid(), v_movement_id)
  RETURNING id INTO v_entry_id;

  UPDATE public.recovery_operations SET updated_at = now() WHERE id = p_operation_id;
  RETURN v_entry_id;
END$function$;

-- 7) Update recovery_close: record waste as a movement (shrinkage→waste). Movement trigger handles the deduction from section_shrinkage_inventory.
CREATE OR REPLACE FUNCTION public.recovery_close(p_operation_id uuid, p_shift_id uuid, p_employee_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ros record;
  v_waste numeric;
  v_existing numeric;
  v_status text;
  v_movement_id uuid;
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
      SELECT total_weight INTO v_existing
      FROM public.section_shrinkage_inventory
      WHERE section_id = v_ros.section_id AND metal_id = v_ros.metal_id
      FOR UPDATE;
      IF NOT FOUND OR v_existing < v_waste - 0.0001 THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ في خسيات القسم لتسجيل الهالك' USING ERRCODE='P0001';
      END IF;

      -- Create the waste movement; the from_type='shrinkage' branch in apply_movement_inventory
      -- will deduct from section_shrinkage_inventory automatically.
      INSERT INTO public.movements(
        from_type, from_id, to_type, to_id, metal_id, karat, weight,
        category_id, count, shift_id, employee_name, created_by_user_id
      ) VALUES (
        'shrinkage', v_ros.section_id, 'waste', v_ros.section_id, v_ros.metal_id, '999', v_waste,
        NULL, NULL, p_shift_id, p_employee_name, auth.uid()
      ) RETURNING id INTO v_movement_id;

      INSERT INTO public.recovery_entries(
        operation_id, section_id, metal_id, weight_999, to_vault_id,
        shift_id, employee_name, created_by_user_id, is_waste, movement_id
      ) VALUES (
        p_operation_id, v_ros.section_id, v_ros.metal_id, v_waste, NULL,
        p_shift_id, p_employee_name, auth.uid(), true, v_movement_id
      );
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
END$function$;
