DO $$
DECLARE
  v_section uuid := '0c1c44c4-cb52-48cf-887f-798a11386dea';
  v_metal uuid := '90e64b01-6d6b-4f9e-8fed-2428cae1d177';
  v_shift uuid;
BEGIN
  SELECT id INTO v_shift FROM public.shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1;
  IF v_shift IS NULL THEN
    SELECT id INTO v_shift FROM public.shifts ORDER BY started_at DESC LIMIT 1;
  END IF;
  IF v_shift IS NULL THEN RETURN; END IF;

  ALTER TABLE public.movements DISABLE TRIGGER trg_apply_movement_inventory;
  ALTER TABLE public.movements DISABLE TRIGGER trg_movements_validate_destination_metal;

  INSERT INTO public.movements(
    from_type, from_id, to_type, to_id, metal_id, karat, weight,
    category_id, count, shift_id, employee_name
  ) VALUES (
    'section', v_section, 'shrinkage', v_section, v_metal, '999', 1.114,
    NULL, NULL, v_shift, 'تسجيل خسية (تصحيح سابق)'
  );

  ALTER TABLE public.movements ENABLE TRIGGER trg_apply_movement_inventory;
  ALTER TABLE public.movements ENABLE TRIGGER trg_movements_validate_destination_metal;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE public.movements ENABLE TRIGGER trg_apply_movement_inventory;
  ALTER TABLE public.movements ENABLE TRIGGER trg_movements_validate_destination_metal;
  RAISE;
END$$;