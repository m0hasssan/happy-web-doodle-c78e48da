CREATE OR REPLACE FUNCTION public.process_section_workorder_return(
  p_work_order_id uuid,
  p_dest_vault_id uuid,
  p_shift_id uuid,
  p_employee_name text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_section uuid;
  v_kind text;
  v_item jsonb;
  v_metal_id uuid;
  v_karat text;
  v_weight numeric;
  v_category_id uuid;
  v_count integer;
  v_target_ratio numeric;
  v_inv record;
  v_inv_id uuid;
  v_target_pure numeric;
  v_have_pure numeric;
  v_take_pure numeric;
  v_take_grams numeric;
  v_src_ratio numeric;
  v_shrink jsonb;
BEGIN
  SELECT to_section_id INTO v_section FROM public.work_orders WHERE id = p_work_order_id;
  IF v_section IS NULL THEN RAISE EXCEPTION 'أمر الشغل غير موجود'; END IF;

  SELECT kind INTO v_kind FROM public.manufacturing_sections WHERE id = v_section;
  IF v_kind <> 'processing' THEN
    RAISE EXCEPTION 'هذا القسم ليس قسم معالجة' USING ERRCODE='P0001';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_metal_id := (v_item->>'metal_id')::uuid;
    v_karat := v_item->>'karat';
    v_weight := (v_item->>'weight')::numeric;
    v_category_id := NULLIF(v_item->>'category_id','')::uuid;
    v_count := NULLIF(v_item->>'count','')::integer;

    IF v_karat IS NULL OR v_karat = '' THEN
      RAISE EXCEPTION 'العيار مطلوب';
    END IF;

    v_target_ratio := CASE WHEN v_karat='999' THEN 1::numeric ELSE v_karat::numeric/1000 END;
    v_target_pure := v_weight * v_target_ratio;

    SELECT COALESCE(SUM(total_weight * (CASE WHEN karat='999' THEN 1::numeric WHEN karat IS NULL THEN 1::numeric ELSE karat::numeric/1000 END)), 0)
      INTO v_have_pure
      FROM public.section_inventory
      WHERE section_id = v_section
        AND metal_id = v_metal_id
        AND category_id IS NOT DISTINCT FROM v_category_id;

    IF v_have_pure + 0.0001 < v_target_pure THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ بالنقاوة في التصنيف المختار (المتاح: % جم 999 / المطلوب: % جم 999)', round(v_have_pure,3), round(v_target_pure,3) USING ERRCODE='P0001';
    END IF;

    FOR v_inv IN
      SELECT id, karat, category_id, total_weight,
        (CASE
          WHEN karat = v_karat THEN 0
          WHEN karat = '999' THEN 1
          ELSE 2
        END) AS pref
      FROM public.section_inventory
      WHERE section_id = v_section
        AND metal_id = v_metal_id
        AND category_id IS NOT DISTINCT FROM v_category_id
        AND total_weight > 0
        AND karat IS NOT NULL
      ORDER BY pref ASC, karat ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_target_pure <= 0.0001;
      v_src_ratio := CASE WHEN v_inv.karat='999' THEN 1::numeric ELSE v_inv.karat::numeric/1000 END;
      v_take_pure := LEAST(v_inv.total_weight * v_src_ratio, v_target_pure);
      v_take_grams := v_take_pure / v_src_ratio;

      UPDATE public.section_inventory
        SET total_weight = total_weight - v_take_grams,
            total_count = CASE WHEN total_weight - v_take_grams <= 0.0001 THEN NULL ELSE total_count END,
            updated_at = now()
        WHERE id = v_inv.id;

      v_target_pure := v_target_pure - v_take_pure;
    END LOOP;

    IF v_target_pure > 0.0001 THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ بالنقاوة في التصنيف المختار لإجراء التحويل' USING ERRCODE='P0001';
    END IF;

    SELECT id INTO v_inv_id FROM public.section_inventory
      WHERE section_id = v_section
        AND metal_id = v_metal_id
        AND karat = v_karat
        AND category_id IS NOT DISTINCT FROM v_category_id
      FOR UPDATE;

    IF FOUND THEN
      UPDATE public.section_inventory
        SET total_weight = total_weight + v_weight,
            updated_at = now()
        WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.section_inventory(section_id, metal_id, karat, category_id, total_weight, total_count)
      VALUES (v_section, v_metal_id, v_karat, v_category_id, v_weight, NULL);
    END IF;

    INSERT INTO public.movements(
      from_type, from_id, to_type, to_id, metal_id, karat, weight,
      category_id, count, work_order_id, shift_id, employee_name
    ) VALUES (
      'section', v_section, 'vault', p_dest_vault_id, v_metal_id, v_karat, v_weight,
      v_category_id, v_count, p_work_order_id, p_shift_id, p_employee_name
    );
  END LOOP;

  v_shrink := public.work_order_apply_shrinkage(p_work_order_id);
  RETURN v_shrink;
END
$function$;