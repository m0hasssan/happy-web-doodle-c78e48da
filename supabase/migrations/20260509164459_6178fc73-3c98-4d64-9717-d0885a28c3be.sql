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
  RETURN NEW;
END$function$;