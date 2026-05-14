-- 1) Create system_settings singleton table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  gold_tolerance numeric(10,6) NOT NULL DEFAULT 0.008,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view system_settings" ON public.system_settings;
CREATE POLICY "Authenticated view system_settings"
  ON public.system_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins insert system_settings" ON public.system_settings;
CREATE POLICY "Admins insert system_settings"
  ON public.system_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update system_settings" ON public.system_settings;
CREATE POLICY "Admins update system_settings"
  ON public.system_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default singleton row
INSERT INTO public.system_settings (singleton, gold_tolerance)
VALUES (true, 0.008)
ON CONFLICT (singleton) DO NOTHING;

-- 2) Helper function to read tolerance
CREATE OR REPLACE FUNCTION public.get_gold_tolerance()
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT gold_tolerance FROM public.system_settings WHERE singleton = true LIMIT 1), 0.008)
$$;

-- 3) Update work_order_apply_shrinkage to use the tolerance
CREATE OR REPLACE FUNCTION public.work_order_apply_shrinkage(p_work_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_section uuid;
  v_kind text;
  v_allow_karat_change boolean := true;
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
  v_zero_count_pure numeric;
  v_shift_id uuid;
  v_consumed_pure numeric;
  v_record_pure numeric;
  v_tolerance numeric;
BEGIN
  v_tolerance := public.get_gold_tolerance();

  SELECT to_section_id INTO v_section FROM public.work_orders WHERE id = p_work_order_id;
  IF v_section IS NULL THEN RAISE EXCEPTION 'أمر الشغل غير موجود'; END IF;

  SELECT id INTO v_shift_id FROM public.shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1;
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'يجب وجود شيفت مفتوح لتسجيل حركات الخسية' USING ERRCODE='P0001';
  END IF;

  SELECT kind INTO v_kind FROM public.manufacturing_sections WHERE id = v_section;
  SELECT COALESCE(allow_karat_change, true) INTO v_allow_karat_change
  FROM public.section_settings WHERE section_id = v_section;
  IF v_allow_karat_change IS NULL THEN v_allow_karat_change := true; END IF;

  FOR r IN
    SELECT si.id, si.metal_id, si.karat, si.category_id, si.total_weight
    FROM public.section_inventory si
    JOIN public.metal_categories mc ON mc.id = si.category_id
    WHERE si.section_id = v_section
      AND si.total_weight > 0.0001
      AND COALESCE(si.total_count, 0) <= 0
      AND mc.requires_count = true
    FOR UPDATE OF si
  LOOP
    v_src_ratio := CASE WHEN r.karat='999' OR r.karat IS NULL THEN 1::numeric ELSE r.karat::numeric/1000 END;
    v_zero_count_pure := r.total_weight * v_src_ratio;

    UPDATE public.section_inventory
      SET total_weight = 0, total_count = 0, updated_at = now()
      WHERE id = r.id;

    SELECT id INTO v_inv_id FROM public.section_inventory
      WHERE section_id = v_section AND metal_id = r.metal_id AND karat = '999' AND category_id IS NULL FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_inventory
        SET total_weight = total_weight + v_zero_count_pure, updated_at = now()
        WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.section_inventory(section_id, metal_id, karat, category_id, total_weight, total_count)
      VALUES (v_section, r.metal_id, '999', NULL, v_zero_count_pure, NULL);
    END IF;

    INSERT INTO public.movements(
      from_type, from_id, to_type, to_id, metal_id, karat, weight,
      category_id, count, work_order_id, shift_id, employee_name
    ) VALUES (
      'section', v_section, 'shrinkage', v_section, r.metal_id, '999', v_zero_count_pure,
      NULL, NULL, p_work_order_id, v_shift_id, 'النظام'
    );

    INSERT INTO public.work_order_shrinkage(
      work_order_id, metal_id, karat, missing_weight, pure_999_weight, section_id
    )
    VALUES (p_work_order_id, r.metal_id, COALESCE(r.karat, '999'), r.total_weight, v_zero_count_pure, v_section);

    v_results := v_results || jsonb_build_object(
      'metal_id', r.metal_id, 'karat', COALESCE(r.karat, '999'),
      'missing', r.total_weight, 'pure_999', v_zero_count_pure
    );
  END LOOP;

  IF v_kind = 'processing' OR v_allow_karat_change THEN
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
      WHERE work_order_id = p_work_order_id AND metal_id = v_metal.metal_id
        AND from_type IN ('vault','section','supplier') AND to_type IN ('vault','section','supplier');

      SELECT COALESCE(SUM(pure_999_weight), 0) INTO v_pure_already
        FROM public.work_order_shrinkage
        WHERE work_order_id = p_work_order_id AND metal_id = v_metal.metal_id;

      v_pure_missing := v_pure_in - v_pure_out - v_pure_already;
      -- Apply industrial tolerance: if missing within tolerance AND no leftover stock,
      -- treat as 100% recovery (no shrinkage).
      IF abs(v_pure_missing) <= v_tolerance AND NOT EXISTS(
        SELECT 1 FROM public.section_inventory
        WHERE section_id = v_section AND metal_id = v_metal.metal_id
          AND total_weight > 0.0001
          AND NOT (karat = '999' AND category_id IS NULL)
      ) THEN
        CONTINUE;
      END IF;

      v_consumed_pure := 0;
      FOR r IN
        SELECT id, karat, total_weight
        FROM public.section_inventory
        WHERE section_id = v_section AND metal_id = v_metal.metal_id AND total_weight > 0
          AND NOT (karat = '999' AND category_id IS NULL)
        ORDER BY (CASE WHEN karat='999' THEN 1 ELSE 0 END) ASC, karat ASC
        FOR UPDATE
      LOOP
        IF r.karat IS NULL THEN CONTINUE; END IF;
        v_src_ratio := CASE WHEN r.karat='999' THEN 1::numeric ELSE r.karat::numeric/1000 END;
        v_take_pure := r.total_weight * v_src_ratio;
        UPDATE public.section_inventory
          SET total_weight = 0, updated_at = now()
          WHERE id = r.id;
        v_consumed_pure := v_consumed_pure + v_take_pure;
      END LOOP;

      v_record_pure := GREATEST(v_consumed_pure, v_pure_missing);
      -- Apply tolerance to the final shrinkage amount as well
      IF v_record_pure <= v_tolerance THEN CONTINUE; END IF;

      SELECT id INTO v_inv_id FROM public.section_inventory
        WHERE section_id = v_section AND metal_id = v_metal.metal_id AND karat = '999' AND category_id IS NULL FOR UPDATE;
      IF FOUND THEN
        UPDATE public.section_inventory
          SET total_weight = total_weight + v_record_pure, updated_at = now()
          WHERE id = v_inv_id;
      ELSE
        INSERT INTO public.section_inventory(section_id, metal_id, karat, category_id, total_weight, total_count)
        VALUES (v_section, v_metal.metal_id, '999', NULL, v_record_pure, NULL);
      END IF;

      INSERT INTO public.movements(
        from_type, from_id, to_type, to_id, metal_id, karat, weight,
        category_id, count, work_order_id, shift_id, employee_name
      ) VALUES (
        'section', v_section, 'shrinkage', v_section, v_metal.metal_id, '999', v_record_pure,
        NULL, NULL, p_work_order_id, v_shift_id, 'النظام'
      );

      INSERT INTO public.work_order_shrinkage(
        work_order_id, metal_id, karat, missing_weight, pure_999_weight, section_id
      )
      VALUES (p_work_order_id, v_metal.metal_id, '999', v_record_pure, v_record_pure, v_section);

      v_results := v_results || jsonb_build_object(
        'metal_id', v_metal.metal_id, 'karat', '999',
        'missing', v_record_pure, 'pure_999', v_record_pure
      );
    END LOOP;

    RETURN v_results;
  END IF;

  FOR r IN
    SELECT metal_id, karat,
      COALESCE(SUM(CASE WHEN to_type='section'   AND to_id=v_section   THEN weight ELSE 0 END),0)
    - COALESCE(SUM(CASE WHEN from_type='section' AND from_id=v_section THEN weight ELSE 0 END),0)
        AS net_out
    FROM public.movements
    WHERE work_order_id = p_work_order_id
      AND from_type IN ('vault','section','supplier') AND to_type IN ('vault','section','supplier')
    GROUP BY metal_id, karat
  LOOP
    IF r.karat IS NULL OR r.karat = '999' THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(missing_weight),0) INTO v_already
      FROM public.work_order_shrinkage
      WHERE work_order_id=p_work_order_id AND metal_id=r.metal_id AND karat=r.karat;

    v_missing := r.net_out - v_already;
    -- Tolerance check on pure equivalent
    IF (v_missing * (r.karat::numeric / 1000.0)) <= v_tolerance THEN CONTINUE; END IF;

    v_pure := round((v_missing * (r.karat::numeric / 1000.0))::numeric, 4);

    SELECT id, total_weight INTO v_inv_id, v_existing
      FROM public.section_inventory
      WHERE section_id=v_section AND metal_id=r.metal_id AND karat IS NOT DISTINCT FROM r.karat
      FOR UPDATE;
    IF NOT FOUND THEN v_existing := 0; END IF;
    IF v_existing < v_missing - 0.02 THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ في القسم لتطبيق تحييف العيار % (المتاح: %, المطلوب: %)', r.karat, v_existing, v_missing USING ERRCODE='P0001';
    END IF;
    v_take_grams := LEAST(v_existing, v_missing);
    IF v_inv_id IS NOT NULL THEN
      UPDATE public.section_inventory SET total_weight = GREATEST(total_weight - v_take_grams, 0), updated_at = now() WHERE id = v_inv_id;
    END IF;

    SELECT id INTO v_inv_id FROM public.section_inventory
      WHERE section_id=v_section AND metal_id=r.metal_id AND karat='999' AND category_id IS NULL FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_inventory SET total_weight = total_weight + v_pure, updated_at = now() WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.section_inventory(section_id, metal_id, karat, category_id, total_weight, total_count)
      VALUES (v_section, r.metal_id, '999', NULL, v_pure, NULL);
    END IF;

    INSERT INTO public.movements(
      from_type, from_id, to_type, to_id, metal_id, karat, weight,
      category_id, count, work_order_id, shift_id, employee_name
    ) VALUES (
      'section', v_section, 'shrinkage', v_section, r.metal_id, '999', v_pure,
      NULL, NULL, p_work_order_id, v_shift_id, 'النظام'
    );

    INSERT INTO public.work_order_shrinkage(work_order_id, metal_id, karat, missing_weight, pure_999_weight, section_id)
    VALUES (p_work_order_id, r.metal_id, r.karat, v_missing, v_pure, v_section);

    v_results := v_results || jsonb_build_object(
      'metal_id', r.metal_id, 'karat', r.karat,
      'missing', v_missing, 'pure_999', v_pure
    );
  END LOOP;

  RETURN v_results;
END$function$;