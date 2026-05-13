CREATE OR REPLACE FUNCTION public.recovery_add_entry_v2(
  p_operation_id uuid,
  p_section_id uuid,
  p_metal_id uuid,
  p_karat text,
  p_weight numeric,
  p_to_vault_id uuid,
  p_shift_id uuid,
  p_employee_name text,
  p_category_id uuid DEFAULT NULL,
  p_count integer DEFAULT NULL
)
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
  v_karat_num numeric;
  v_pure999 numeric;
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

  BEGIN
    v_karat_num := p_karat::numeric;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'العيار غير صحيح: %', p_karat USING ERRCODE='P0001';
  END;
  IF v_karat_num <= 0 OR v_karat_num > 999 THEN
    RAISE EXCEPTION 'العيار يجب أن يكون بين 1 و 999' USING ERRCODE='P0001';
  END IF;

  v_pure999 := round((p_weight * v_karat_num / 999.0)::numeric, 4);

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
  IF v_pure999 > v_remaining + 0.0001 THEN
    RAISE EXCEPTION 'المعادل بعيار 999 (%) أكبر من الخسية المتبقية (%)', v_pure999, v_remaining USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.movements(
    from_type, from_id, to_type, to_id, metal_id, karat, weight,
    category_id, count, shift_id, employee_name
  ) VALUES (
    'shrinkage', p_section_id, 'vault', p_to_vault_id, p_metal_id, p_karat, p_weight,
    p_category_id, p_count, p_shift_id, p_employee_name
  );

  UPDATE public.recovery_operation_sections
    SET recovered_999 = recovered_999 + v_pure999
    WHERE id = v_ros.id;

  INSERT INTO public.recovery_entries(operation_id, section_id, metal_id, weight_999, to_vault_id, shift_id, employee_name, created_by_user_id)
  VALUES (p_operation_id, p_section_id, p_metal_id, v_pure999, p_to_vault_id, p_shift_id, p_employee_name, auth.uid())
  RETURNING id INTO v_entry_id;

  UPDATE public.recovery_operations SET updated_at = now() WHERE id = p_operation_id;
  RETURN v_entry_id;
END$function$;