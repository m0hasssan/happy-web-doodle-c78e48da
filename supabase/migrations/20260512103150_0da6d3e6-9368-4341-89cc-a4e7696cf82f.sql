
ALTER TABLE public.recovery_entries ALTER COLUMN to_vault_id DROP NOT NULL;
ALTER TABLE public.recovery_entries ADD COLUMN IF NOT EXISTS is_waste boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.recovery_close(p_operation_id uuid, p_shift_id uuid, p_employee_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

      -- Record waste as a recovery_entry (no vault, is_waste=true)
      INSERT INTO public.recovery_entries(
        operation_id, section_id, metal_id, weight_999, to_vault_id,
        shift_id, employee_name, created_by_user_id, is_waste
      ) VALUES (
        p_operation_id, v_ros.section_id, v_ros.metal_id, v_waste, NULL,
        p_shift_id, p_employee_name, auth.uid(), true
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
