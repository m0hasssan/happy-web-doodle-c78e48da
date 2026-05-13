CREATE OR REPLACE FUNCTION public.apply_movement_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing numeric;
  v_id uuid;
  v_existing_count integer;
  v_from_processing boolean := false;
  v_to_processing boolean := false;
  v_from_allow_count_change boolean := false;
  v_from_allow_karat_change boolean := false;
  v_from_allow_category_change boolean := false;
  v_flexible boolean := false;
  v_target_pure numeric;
  v_have_pure numeric;
  v_remaining_pure numeric;
  v_take_pure numeric;
  v_take_grams numeric;
  v_src_ratio numeric;
  v_count_remaining integer;
  v_count_take integer;
  v_inv record;
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.metal_categories WHERE parent_id = NEW.category_id) THEN
      RAISE EXCEPTION 'يجب اختيار التصنيف الفرعي النهائي (التصنيف المختار يحتوي على تصنيفات فرعية)' USING ERRCODE='P0001';
    END IF;
  END IF;

  IF NEW.from_type = 'section' THEN
    SELECT (kind = 'processing') INTO v_from_processing FROM public.manufacturing_sections WHERE id = NEW.from_id;
    SELECT
      COALESCE(allow_count_change, true),
      COALESCE(allow_karat_change, true),
      COALESCE(allow_category_change, true)
    INTO v_from_allow_count_change, v_from_allow_karat_change, v_from_allow_category_change
    FROM public.section_settings WHERE section_id = NEW.from_id;
    IF v_from_allow_count_change IS NULL THEN v_from_allow_count_change := true; END IF;
    IF v_from_allow_karat_change IS NULL THEN v_from_allow_karat_change := true; END IF;
    IF v_from_allow_category_change IS NULL THEN v_from_allow_category_change := true; END IF;
    v_flexible := v_from_allow_karat_change OR v_from_allow_category_change;
  END IF;
  IF NEW.to_type = 'section' THEN
    SELECT (kind = 'processing') INTO v_to_processing FROM public.manufacturing_sections WHERE id = NEW.to_id;
  END IF;

  IF NEW.from_type = 'shrinkage' THEN
    DECLARE v_karat_num numeric; v_pure999 numeric;
    BEGIN
      BEGIN v_karat_num := NEW.karat::numeric;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'العيار غير صحيح: %', NEW.karat USING ERRCODE='P0001';
      END;
      IF v_karat_num <= 0 OR v_karat_num > 999 THEN
        RAISE EXCEPTION 'العيار يجب أن يكون بين 1 و 999' USING ERRCODE='P0001';
      END IF;
      v_pure999 := round((NEW.weight * v_karat_num / 999.0)::numeric, 4);
      SELECT id, total_weight INTO v_id, v_existing
      FROM public.section_shrinkage_inventory
      WHERE section_id = NEW.from_id AND metal_id = NEW.metal_id
      FOR UPDATE;
      IF NOT FOUND OR v_existing < v_pure999 - 0.0001 THEN
        RAISE EXCEPTION 'رصيد الخسية غير كافٍ (المتاح: % جم 999, المطلوب: % جم 999)', COALESCE(v_existing,0), v_pure999 USING ERRCODE='P0001';
      END IF;
      UPDATE public.section_shrinkage_inventory
        SET total_weight = total_weight - v_pure999, updated_at = now()
        WHERE id = v_id;
    END;
  END IF;

  IF NEW.from_type = 'vault' THEN
    SELECT id, total_weight, total_count INTO v_id, v_existing, v_existing_count FROM public.vault_inventory
     WHERE vault_id=NEW.from_id AND metal_id=NEW.metal_id
       AND karat IS NOT DISTINCT FROM NEW.karat
       AND category_id IS NOT DISTINCT FROM NEW.category_id
     FOR UPDATE;
    IF NOT FOUND OR v_existing < NEW.weight THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ في الخزنة (المتاح: %, المطلوب: %)', COALESCE(v_existing,0), NEW.weight USING ERRCODE='P0001';
    END IF;
    IF NEW.count IS NOT NULL THEN
      IF COALESCE(v_existing_count,0) < NEW.count THEN
        RAISE EXCEPTION 'العدد غير كافٍ في الخزنة (المتاح: %, المطلوب: %)', COALESCE(v_existing_count,0), NEW.count USING ERRCODE='P0001';
      END IF;
      IF v_existing_count = 1 AND NEW.weight > 0 AND ABS(v_existing - NEW.weight) > 0.0001 THEN
        RAISE EXCEPTION 'لا يمكن إخراج وزن جزئي من قطعة واحدة (الوزن المتاح: %, المطلوب: %)', v_existing, NEW.weight USING ERRCODE='P0001';
      END IF;
      IF NEW.count < v_existing_count AND ABS(v_existing - NEW.weight) <= 0.0001 THEN
        RAISE EXCEPTION 'لا يمكن إخراج كامل الوزن مع ترك قطع متبقية. اترك وزناً للقطع المتبقية (المتبقي بعد الإخراج: % قطعة بدون وزن)', (v_existing_count - NEW.count) USING ERRCODE='P0001';
      END IF;
      UPDATE public.vault_inventory
        SET total_weight=total_weight-NEW.weight,
            total_count=total_count-NEW.count,
            updated_at=now()
        WHERE id=v_id;
    ELSE
      UPDATE public.vault_inventory SET total_weight=total_weight-NEW.weight, updated_at=now() WHERE id=v_id;
    END IF;
  END IF;

  IF NEW.from_type = 'section' THEN
    IF v_flexible THEN
      v_target_pure := NEW.weight * (CASE WHEN NEW.karat='999' OR NEW.karat IS NULL THEN 1::numeric ELSE NEW.karat::numeric/1000 END);

      SELECT COALESCE(SUM(total_weight * (CASE WHEN karat='999' OR karat IS NULL THEN 1::numeric ELSE karat::numeric/1000 END)), 0)
        INTO v_have_pure
      FROM public.section_inventory
      WHERE section_id = NEW.from_id
        AND metal_id = NEW.metal_id
        AND (v_from_allow_karat_change OR karat IS NOT DISTINCT FROM NEW.karat)
        AND (v_from_allow_category_change OR category_id IS NOT DISTINCT FROM NEW.category_id);

      IF v_have_pure + 0.0001 < v_target_pure THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ في القسم بالنقاوة (المتاح: %, المطلوب: %)', round(COALESCE(v_have_pure,0), 4), round(v_target_pure, 4) USING ERRCODE='P0001';
      END IF;

      IF NEW.count IS NOT NULL AND NOT v_from_processing AND NOT v_from_allow_count_change THEN
        SELECT COALESCE(SUM(total_count), 0) INTO v_existing_count
        FROM public.section_inventory
        WHERE section_id = NEW.from_id
          AND metal_id = NEW.metal_id
          AND (v_from_allow_karat_change OR karat IS NOT DISTINCT FROM NEW.karat)
          AND (v_from_allow_category_change OR category_id IS NOT DISTINCT FROM NEW.category_id);
        IF COALESCE(v_existing_count,0) < NEW.count THEN
          RAISE EXCEPTION 'العدد غير كافٍ في القسم (المتاح: %, المطلوب: %)', COALESCE(v_existing_count,0), NEW.count USING ERRCODE='P0001';
        END IF;
      END IF;

      v_remaining_pure := v_target_pure;
      v_count_remaining := COALESCE(NEW.count, 0);

      FOR v_inv IN
        SELECT id, karat, total_weight, total_count,
          (CASE WHEN karat IS NOT DISTINCT FROM NEW.karat AND category_id IS NOT DISTINCT FROM NEW.category_id THEN 0
                WHEN karat IS NOT DISTINCT FROM NEW.karat THEN 1
                WHEN karat = '999' THEN 2
                ELSE 3 END) AS pref
        FROM public.section_inventory
        WHERE section_id = NEW.from_id
          AND metal_id = NEW.metal_id
          AND (v_from_allow_karat_change OR karat IS NOT DISTINCT FROM NEW.karat)
          AND (v_from_allow_category_change OR category_id IS NOT DISTINCT FROM NEW.category_id)
          AND total_weight > 0
        ORDER BY pref ASC, karat ASC NULLS LAST
        FOR UPDATE
      LOOP
        EXIT WHEN v_remaining_pure <= 0.0001;
        v_src_ratio := CASE WHEN v_inv.karat='999' OR v_inv.karat IS NULL THEN 1::numeric ELSE v_inv.karat::numeric/1000 END;
        v_take_pure := LEAST(v_inv.total_weight * v_src_ratio, v_remaining_pure);
        v_take_grams := v_take_pure / v_src_ratio;
        v_count_take := 0;

        IF NEW.count IS NOT NULL THEN
          IF (v_from_processing OR v_from_allow_count_change) THEN
            v_count_take := LEAST(COALESCE(v_inv.total_count, 0), NEW.count);
          ELSIF v_count_remaining > 0 THEN
            v_count_take := LEAST(COALESCE(v_inv.total_count, 0), v_count_remaining);
            v_count_remaining := v_count_remaining - v_count_take;
          END IF;
        END IF;

        UPDATE public.section_inventory
          SET total_weight = total_weight - v_take_grams,
              total_count = CASE
                WHEN NEW.count IS NULL THEN total_count
                WHEN COALESCE(total_count,0) <= 0 THEN total_count
                ELSE GREATEST(COALESCE(total_count,0) - v_count_take, 0)
              END,
              updated_at = now()
          WHERE id = v_inv.id;

        v_remaining_pure := v_remaining_pure - v_take_pure;
      END LOOP;

      IF v_remaining_pure > 0.0001 THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ في القسم بالنقاوة لإجراء التحويل' USING ERRCODE='P0001';
      END IF;
      IF NEW.count IS NOT NULL AND NOT v_from_processing AND NOT v_from_allow_count_change AND v_count_remaining > 0 THEN
        RAISE EXCEPTION 'العدد غير كافٍ في القسم (المتبقي غير المتاح: %)', v_count_remaining USING ERRCODE='P0001';
      END IF;
    ELSE
      SELECT id, total_weight, total_count INTO v_id, v_existing, v_existing_count FROM public.section_inventory
       WHERE section_id=NEW.from_id AND metal_id=NEW.metal_id
         AND karat IS NOT DISTINCT FROM NEW.karat
         AND category_id IS NOT DISTINCT FROM NEW.category_id
       FOR UPDATE;
      IF NOT FOUND OR v_existing < NEW.weight THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ في القسم (المتاح: %, المطلوب: %)', COALESCE(v_existing,0), NEW.weight USING ERRCODE='P0001';
      END IF;
      IF NEW.count IS NOT NULL AND NOT v_from_processing AND NOT v_from_allow_count_change THEN
        IF COALESCE(v_existing_count,0) < NEW.count THEN
          RAISE EXCEPTION 'العدد غير كافٍ في القسم (المتاح: %, المطلوب: %)', COALESCE(v_existing_count,0), NEW.count USING ERRCODE='P0001';
        END IF;
        IF NEW.count < v_existing_count AND ABS(v_existing - NEW.weight) <= 0.0001 THEN
          RAISE EXCEPTION 'لا يمكن إخراج كامل الوزن مع ترك قطع متبقية. اترك وزناً للقطع المتبقية (المتبقي بعد الإخراج: % قطعة بدون وزن)', (v_existing_count - NEW.count) USING ERRCODE='P0001';
        END IF;
        UPDATE public.section_inventory
          SET total_weight=total_weight-NEW.weight,
              total_count=total_count-NEW.count,
              updated_at=now()
          WHERE id=v_id;
      ELSE
        UPDATE public.section_inventory
          SET total_weight=total_weight-NEW.weight,
              total_count = CASE
                WHEN (v_from_processing OR v_from_allow_count_change) AND NEW.count IS NOT NULL
                  THEN GREATEST(COALESCE(total_count,0) - NEW.count, 0)
                ELSE total_count
              END,
              updated_at=now()
          WHERE id=v_id;
      END IF;
    END IF;
  END IF;

  IF NEW.to_type = 'vault' THEN
    SELECT id INTO v_id FROM public.vault_inventory
     WHERE vault_id=NEW.to_id AND metal_id=NEW.metal_id
       AND karat IS NOT DISTINCT FROM NEW.karat
       AND category_id IS NOT DISTINCT FROM NEW.category_id
     FOR UPDATE;
    IF FOUND THEN
      UPDATE public.vault_inventory
        SET total_weight=total_weight+NEW.weight,
            total_count = CASE
              WHEN NEW.count IS NOT NULL THEN COALESCE(total_count,0)+NEW.count
              ELSE total_count
            END,
            updated_at=now()
        WHERE id=v_id;
    ELSE
      INSERT INTO public.vault_inventory(vault_id,metal_id,karat,category_id,total_weight,total_count)
      VALUES (NEW.to_id,NEW.metal_id,NEW.karat,NEW.category_id,NEW.weight, NEW.count);
    END IF;
  END IF;

  IF NEW.to_type = 'section' THEN
    SELECT id INTO v_id FROM public.section_inventory
     WHERE section_id=NEW.to_id AND metal_id=NEW.metal_id
       AND karat IS NOT DISTINCT FROM NEW.karat
       AND category_id IS NOT DISTINCT FROM NEW.category_id
     FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_inventory
        SET total_weight=total_weight+NEW.weight,
            total_count = CASE
              WHEN NEW.count IS NOT NULL THEN COALESCE(total_count,0)+NEW.count
              ELSE total_count
            END,
            updated_at=now()
        WHERE id=v_id;
    ELSE
      INSERT INTO public.section_inventory(section_id,metal_id,karat,category_id,total_weight,total_count)
      VALUES (NEW.to_id,NEW.metal_id,NEW.karat,NEW.category_id,NEW.weight, NEW.count);
    END IF;
  END IF;

  IF NEW.to_type = 'shrinkage' THEN
    IF NEW.karat IS DISTINCT FROM '999' THEN
      RAISE EXCEPTION 'حركة الخسية يجب أن تكون بعيار 999' USING ERRCODE='P0001';
    END IF;
    SELECT id INTO v_id FROM public.section_shrinkage_inventory
      WHERE section_id = NEW.to_id AND metal_id = NEW.metal_id
      FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_shrinkage_inventory
        SET total_weight = total_weight + NEW.weight, updated_at = now()
        WHERE id = v_id;
    ELSE
      INSERT INTO public.section_shrinkage_inventory(section_id, metal_id, total_weight)
      VALUES (NEW.to_id, NEW.metal_id, NEW.weight);
    END IF;
  END IF;
  RETURN NEW;
END$function$;

CREATE OR REPLACE FUNCTION public.reverse_movement_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing numeric; v_id uuid; v_existing_count integer;
  v_from_processing boolean := false;
  v_to_processing boolean := false;
BEGIN
  IF OLD.from_type = 'section' THEN
    SELECT (kind = 'processing') INTO v_from_processing FROM public.manufacturing_sections WHERE id = OLD.from_id;
  END IF;
  IF OLD.to_type = 'section' THEN
    SELECT (kind = 'processing') INTO v_to_processing FROM public.manufacturing_sections WHERE id = OLD.to_id;
  END IF;

  IF OLD.to_type = 'vault' THEN
    SELECT id,total_weight,total_count INTO v_id,v_existing,v_existing_count FROM public.vault_inventory
     WHERE vault_id=OLD.to_id AND metal_id=OLD.metal_id
       AND karat IS NOT DISTINCT FROM OLD.karat
       AND category_id IS NOT DISTINCT FROM OLD.category_id
     FOR UPDATE;
    IF NOT FOUND OR v_existing < OLD.weight THEN
      RAISE EXCEPTION 'لا يمكن حذف الحركة: الرصيد الحالي أقل من وزن الحركة' USING ERRCODE='P0001';
    END IF;
    UPDATE public.vault_inventory
      SET total_weight=total_weight-OLD.weight,
          total_count = CASE WHEN OLD.count IS NOT NULL THEN COALESCE(total_count,0)-OLD.count ELSE total_count END,
          updated_at=now()
      WHERE id=v_id;
  END IF;
  IF OLD.to_type = 'section' THEN
    SELECT id,total_weight,total_count INTO v_id,v_existing,v_existing_count FROM public.section_inventory
     WHERE section_id=OLD.to_id AND metal_id=OLD.metal_id
       AND karat IS NOT DISTINCT FROM OLD.karat
       AND category_id IS NOT DISTINCT FROM OLD.category_id
     FOR UPDATE;
    IF NOT FOUND OR v_existing < OLD.weight THEN
      RAISE EXCEPTION 'لا يمكن حذف الحركة: الرصيد الحالي أقل من وزن الحركة' USING ERRCODE='P0001';
    END IF;
    UPDATE public.section_inventory
      SET total_weight=total_weight-OLD.weight,
          total_count = CASE
            WHEN v_to_processing THEN total_count
            WHEN OLD.count IS NOT NULL THEN COALESCE(total_count,0)-OLD.count
            ELSE total_count
          END,
          updated_at=now()
      WHERE id=v_id;
  END IF;
  IF OLD.to_type = 'shrinkage' THEN
    SELECT id, total_weight INTO v_id, v_existing FROM public.section_shrinkage_inventory
      WHERE section_id = OLD.to_id AND metal_id = OLD.metal_id FOR UPDATE;
    IF NOT FOUND OR v_existing < OLD.weight THEN
      RAISE EXCEPTION 'لا يمكن حذف الحركة: رصيد الخسية أقل من وزن الحركة' USING ERRCODE='P0001';
    END IF;
    UPDATE public.section_shrinkage_inventory
      SET total_weight = total_weight - OLD.weight, updated_at = now()
      WHERE id = v_id;
  END IF;
  IF OLD.from_type = 'vault' THEN
    SELECT id INTO v_id FROM public.vault_inventory
     WHERE vault_id=OLD.from_id AND metal_id=OLD.metal_id
       AND karat IS NOT DISTINCT FROM OLD.karat
       AND category_id IS NOT DISTINCT FROM OLD.category_id
     FOR UPDATE;
    IF FOUND THEN
      UPDATE public.vault_inventory
        SET total_weight=total_weight+OLD.weight,
            total_count = CASE WHEN OLD.count IS NOT NULL THEN COALESCE(total_count,0)+OLD.count ELSE total_count END,
            updated_at=now()
        WHERE id=v_id;
    ELSE
      INSERT INTO public.vault_inventory(vault_id,metal_id,karat,category_id,total_weight,total_count)
      VALUES (OLD.from_id,OLD.metal_id,OLD.karat,OLD.category_id,OLD.weight,OLD.count);
    END IF;
  END IF;
  IF OLD.from_type = 'section' THEN
    SELECT id INTO v_id FROM public.section_inventory
     WHERE section_id=OLD.from_id AND metal_id=OLD.metal_id
       AND karat IS NOT DISTINCT FROM OLD.karat
       AND category_id IS NOT DISTINCT FROM OLD.category_id
     FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_inventory
        SET total_weight=total_weight+OLD.weight,
            total_count = CASE
              WHEN v_from_processing THEN total_count
              WHEN OLD.count IS NOT NULL THEN COALESCE(total_count,0)+OLD.count
              ELSE total_count
            END,
            updated_at=now()
        WHERE id=v_id;
    ELSE
      INSERT INTO public.section_inventory(section_id,metal_id,karat,category_id,total_weight,total_count)
      VALUES (OLD.from_id,OLD.metal_id,OLD.karat,OLD.category_id,OLD.weight,
              CASE WHEN v_from_processing THEN NULL ELSE OLD.count END);
    END IF;
  END IF;
  IF OLD.from_type = 'shrinkage' THEN
    DECLARE v_karat_num numeric; v_pure999 numeric;
    BEGIN
      BEGIN v_karat_num := OLD.karat::numeric;
      EXCEPTION WHEN others THEN v_karat_num := 999;
      END;
      v_pure999 := round((OLD.weight * v_karat_num / 999.0)::numeric, 4);
      SELECT id INTO v_id FROM public.section_shrinkage_inventory
        WHERE section_id = OLD.from_id AND metal_id = OLD.metal_id FOR UPDATE;
      IF FOUND THEN
        UPDATE public.section_shrinkage_inventory
          SET total_weight = total_weight + v_pure999, updated_at = now()
          WHERE id = v_id;
      ELSE
        INSERT INTO public.section_shrinkage_inventory(section_id, metal_id, total_weight)
        VALUES (OLD.from_id, OLD.metal_id, v_pure999);
      END IF;
    END;
  END IF;
  RETURN OLD;
END$function$;

CREATE OR REPLACE FUNCTION public.recovery_quick_entry(
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

  RETURN v_movement_id;
END$function$;