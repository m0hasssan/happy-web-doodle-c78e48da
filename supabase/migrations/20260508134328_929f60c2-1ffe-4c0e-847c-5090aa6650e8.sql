
-- Helper: pure ratio per karat (999 = 1.0, others = karat/1000)
-- Inlined directly in functions below.

CREATE OR REPLACE FUNCTION public.work_order_apply_shrinkage(p_work_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r record;
  v_section uuid;
  v_kind text;
  v_pure numeric;
  v_inv_id uuid;
  v_existing numeric;
  v_already numeric;
  v_missing numeric;
  v_results jsonb := '[]'::jsonb;
  v_metal record;
  v_pure_in numeric;
  v_pure_out numeric;
  v_pure_already numeric;
  v_pure_missing numeric;
  v_take_pure numeric;
  v_take_grams numeric;
  v_src_ratio numeric;
BEGIN
  SELECT to_section_id INTO v_section FROM public.work_orders WHERE id = p_work_order_id;
  IF v_section IS NULL THEN
    RAISE EXCEPTION 'أمر الشغل غير موجود';
  END IF;
  SELECT kind INTO v_kind FROM public.manufacturing_sections WHERE id = v_section;

  IF v_kind = 'processing' THEN
    -- Pure-weight based shrinkage per metal (karat-agnostic)
    FOR v_metal IN
      SELECT DISTINCT metal_id FROM public.movements WHERE work_order_id = p_work_order_id
    LOOP
      SELECT
        COALESCE(SUM(CASE WHEN to_type='section' AND to_id=v_section
                          THEN weight * (CASE WHEN karat='999' THEN 1::numeric
                                              WHEN karat IS NULL THEN 1::numeric
                                              ELSE karat::numeric/1000 END)
                          ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN from_type='section' AND from_id=v_section
                          THEN weight * (CASE WHEN karat='999' THEN 1::numeric
                                              WHEN karat IS NULL THEN 1::numeric
                                              ELSE karat::numeric/1000 END)
                          ELSE 0 END), 0)
      INTO v_pure_in, v_pure_out
      FROM public.movements
      WHERE work_order_id = p_work_order_id AND metal_id = v_metal.metal_id;

      SELECT COALESCE(SUM(pure_999_weight), 0) INTO v_pure_already
        FROM public.work_order_shrinkage
        WHERE work_order_id = p_work_order_id AND metal_id = v_metal.metal_id;

      v_pure_missing := v_pure_in - v_pure_out - v_pure_already;
      IF v_pure_missing <= 0.0001 THEN CONTINUE; END IF;

      -- Deduct pure-equivalent grams from existing section inventory rows for this metal
      FOR r IN
        SELECT id, karat, total_weight
        FROM public.section_inventory
        WHERE section_id = v_section AND metal_id = v_metal.metal_id AND total_weight > 0
        ORDER BY (CASE WHEN karat='999' THEN 1 ELSE 0 END) ASC, karat ASC
        FOR UPDATE
      LOOP
        EXIT WHEN v_pure_missing <= 0.0001;
        IF r.karat IS NULL THEN CONTINUE; END IF;
        v_src_ratio := CASE WHEN r.karat='999' THEN 1::numeric ELSE r.karat::numeric/1000 END;
        v_take_pure := LEAST(r.total_weight * v_src_ratio, v_pure_missing);
        v_take_grams := v_take_pure / v_src_ratio;
        UPDATE public.section_inventory
          SET total_weight = total_weight - v_take_grams, updated_at = now()
          WHERE id = r.id;
        v_pure_missing := v_pure_missing - v_take_pure;
      END LOOP;

      IF v_pure_missing > 0.0001 THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ في القسم لتطبيق التحييف';
      END IF;

      -- Re-compute the actually-applied pure missing to record
      v_pure_missing := v_pure_in - v_pure_out - v_pure_already;

      -- Add as 999 inventory in the section (residual loss)
      SELECT id INTO v_inv_id FROM public.section_inventory
        WHERE section_id = v_section AND metal_id = v_metal.metal_id AND karat = '999' FOR UPDATE;
      IF FOUND THEN
        UPDATE public.section_inventory
          SET total_weight = total_weight + v_pure_missing, updated_at = now()
          WHERE id = v_inv_id;
      ELSE
        INSERT INTO public.section_inventory(section_id, metal_id, karat, total_weight)
        VALUES (v_section, v_metal.metal_id, '999', v_pure_missing);
      END IF;

      INSERT INTO public.work_order_shrinkage(
        work_order_id, metal_id, karat, missing_weight, pure_999_weight, section_id
      )
      VALUES (p_work_order_id, v_metal.metal_id, '999', v_pure_missing, v_pure_missing, v_section);

      v_results := v_results || jsonb_build_object(
        'metal_id', v_metal.metal_id, 'karat', '999',
        'missing', v_pure_missing, 'pure_999', v_pure_missing
      );
    END LOOP;

    RETURN v_results;
  END IF;

  -- ===== Original manufacturing logic =====
  FOR r IN
    SELECT metal_id, karat,
      COALESCE(SUM(CASE WHEN to_type='section'   AND to_id=v_section   THEN weight ELSE 0 END),0)
    - COALESCE(SUM(CASE WHEN from_type='section' AND from_id=v_section THEN weight ELSE 0 END),0)
        AS net_out
    FROM public.movements
    WHERE work_order_id = p_work_order_id
    GROUP BY metal_id, karat
  LOOP
    IF r.karat IS NULL OR r.karat = '999' THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(missing_weight),0) INTO v_already
      FROM public.work_order_shrinkage
      WHERE work_order_id=p_work_order_id AND metal_id=r.metal_id AND karat=r.karat;

    v_missing := r.net_out - v_already;
    IF v_missing <= 0.0001 THEN CONTINUE; END IF;

    v_pure := round((v_missing * (r.karat::numeric / 1000.0))::numeric, 4);

    SELECT id, total_weight INTO v_inv_id, v_existing
      FROM public.section_inventory
      WHERE section_id=v_section AND metal_id=r.metal_id AND karat IS NOT DISTINCT FROM r.karat
      FOR UPDATE;
    IF NOT FOUND OR v_existing < v_missing - 0.0001 THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ في القسم لتطبيق تحييف العيار %', r.karat;
    END IF;
    UPDATE public.section_inventory SET total_weight = total_weight - v_missing, updated_at = now() WHERE id = v_inv_id;

    SELECT id INTO v_inv_id FROM public.section_inventory
      WHERE section_id=v_section AND metal_id=r.metal_id AND karat='999' FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_inventory SET total_weight = total_weight + v_pure, updated_at = now() WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.section_inventory(section_id, metal_id, karat, total_weight)
      VALUES (v_section, r.metal_id, '999', v_pure);
    END IF;

    INSERT INTO public.work_order_shrinkage(work_order_id, metal_id, karat, missing_weight, pure_999_weight, section_id)
    VALUES (p_work_order_id, r.metal_id, r.karat, v_missing, v_pure, v_section);

    v_results := v_results || jsonb_build_object(
      'metal_id', r.metal_id, 'karat', r.karat,
      'missing', v_missing, 'pure_999', v_pure
    );
  END LOOP;

  RETURN v_results;
END$function$;


CREATE OR REPLACE FUNCTION public.process_section_workorder_return(
  p_work_order_id uuid,
  p_dest_vault_id uuid,
  p_shift_id uuid,
  p_employee_name text,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_already numeric;
  v_shortfall_grams numeric;
  v_shortfall_pure numeric;
  v_inv record;
  v_take_pure numeric;
  v_take_grams numeric;
  v_inv_id uuid;
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

    -- How much do we already have at the target karat?
    SELECT total_weight INTO v_already
      FROM public.section_inventory
      WHERE section_id = v_section AND metal_id = v_metal_id AND karat = v_karat;

    IF COALESCE(v_already, 0) < v_weight THEN
      v_shortfall_grams := v_weight - COALESCE(v_already, 0);
      v_shortfall_pure := v_shortfall_grams * v_target_ratio;

      -- Convert from any other karat in this section for this metal
      FOR v_inv IN
        SELECT id, karat, total_weight FROM public.section_inventory
         WHERE section_id = v_section AND metal_id = v_metal_id
           AND karat IS NOT NULL AND karat <> v_karat AND total_weight > 0
         ORDER BY (CASE WHEN karat='999' THEN 1 ELSE 0 END) ASC, karat ASC
         FOR UPDATE
      LOOP
        EXIT WHEN v_shortfall_pure <= 0.0001;
        v_src_ratio := CASE WHEN v_inv.karat='999' THEN 1::numeric ELSE v_inv.karat::numeric/1000 END;
        v_take_pure := LEAST(v_inv.total_weight * v_src_ratio, v_shortfall_pure);
        v_take_grams := v_take_pure / v_src_ratio;
        UPDATE public.section_inventory
          SET total_weight = total_weight - v_take_grams, updated_at = now()
          WHERE id = v_inv.id;
        v_shortfall_pure := v_shortfall_pure - v_take_pure;
      END LOOP;

      IF v_shortfall_pure > 0.0001 THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ بالنقاوة في القسم لإجراء التحويل' USING ERRCODE='P0001';
      END IF;

      -- Add converted weight to target karat
      SELECT id INTO v_inv_id FROM public.section_inventory
        WHERE section_id = v_section AND metal_id = v_metal_id AND karat = v_karat FOR UPDATE;
      IF FOUND THEN
        UPDATE public.section_inventory
          SET total_weight = total_weight + v_shortfall_grams, updated_at = now()
          WHERE id = v_inv_id;
      ELSE
        INSERT INTO public.section_inventory(section_id, metal_id, karat, total_weight)
        VALUES (v_section, v_metal_id, v_karat, v_shortfall_grams);
      END IF;
    END IF;

    -- Insert the actual section -> vault movement (trigger deducts target karat from section, credits vault)
    INSERT INTO public.movements(
      from_type, from_id, to_type, to_id, metal_id, karat, weight,
      category_id, count, work_order_id, shift_id, employee_name
    ) VALUES (
      'section', v_section, 'vault', p_dest_vault_id, v_metal_id, v_karat, v_weight,
      v_category_id, v_count, p_work_order_id, p_shift_id, p_employee_name
    );
  END LOOP;

  -- Apply shrinkage (pure-based path)
  v_shrink := public.work_order_apply_shrinkage(p_work_order_id);
  RETURN v_shrink;
END$function$;
