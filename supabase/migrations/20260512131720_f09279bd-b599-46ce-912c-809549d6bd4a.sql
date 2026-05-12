
-- 1) Shrinkage inventory table per (section, metal)
CREATE TABLE IF NOT EXISTS public.section_shrinkage_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  metal_id uuid NOT NULL,
  total_weight numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, metal_id)
);

ALTER TABLE public.section_shrinkage_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View shrinkage_inventory with permission"
ON public.section_shrinkage_inventory
FOR SELECT TO authenticated
USING (
  has_permission(auth.uid(), 'view_section_data'::app_permission, section_id)
  OR has_permission(auth.uid(), 'access_section'::app_permission, section_id)
  OR has_permission(auth.uid(), 'view_recovery'::app_permission)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Triggers/functions write to this table via SECURITY DEFINER, so no INSERT/UPDATE policies needed.

CREATE TRIGGER trg_section_shrinkage_inventory_updated_at
BEFORE UPDATE ON public.section_shrinkage_inventory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Migrate existing 999/null section_inventory rows into shrinkage_inventory
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT section_id, metal_id, SUM(total_weight) AS w
    FROM public.section_inventory
    WHERE karat = '999' AND category_id IS NULL AND total_weight > 0
    GROUP BY section_id, metal_id
  LOOP
    INSERT INTO public.section_shrinkage_inventory(section_id, metal_id, total_weight)
    VALUES (r.section_id, r.metal_id, r.w)
    ON CONFLICT (section_id, metal_id)
    DO UPDATE SET total_weight = public.section_shrinkage_inventory.total_weight + EXCLUDED.total_weight,
                  updated_at = now();
  END LOOP;
  -- remove migrated rows from section_inventory
  DELETE FROM public.section_inventory
  WHERE karat = '999' AND category_id IS NULL;
END $$;

-- 3) Update destination metal validation to skip shrinkage type
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
    IF NOT allowed THEN
      RAISE EXCEPTION 'الخزنة الوجهة لا تقبل هذا المعدن' USING ERRCODE='P0001';
    END IF;
  END IF;
  IF NEW.to_type = 'section' THEN
    SELECT EXISTS(SELECT 1 FROM public.section_metals WHERE section_id = NEW.to_id AND metal_id = NEW.metal_id) INTO allowed;
    IF NOT allowed THEN
      RAISE EXCEPTION 'القسم الوجهة لا تقبل هذا المعدن' USING ERRCODE='P0001';
    END IF;
  END IF;
  -- shrinkage destination: no validation needed (always 999, internal account of section)
  RETURN NEW;
END$function$;

-- 4) Update apply_movement_inventory to handle shrinkage type
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

  -- Shrinkage source: deduct from shrinkage_inventory (always 999 pure)
  IF NEW.from_type = 'shrinkage' THEN
    IF NEW.karat IS DISTINCT FROM '999' THEN
      RAISE EXCEPTION 'حركة الخسية يجب أن تكون بعيار 999' USING ERRCODE='P0001';
    END IF;
    SELECT id, total_weight INTO v_id, v_existing
    FROM public.section_shrinkage_inventory
    WHERE section_id = NEW.from_id AND metal_id = NEW.metal_id
    FOR UPDATE;
    IF NOT FOUND OR v_existing < NEW.weight - 0.0001 THEN
      RAISE EXCEPTION 'رصيد الخسية غير كافٍ (المتاح: %, المطلوب: %)', COALESCE(v_existing,0), NEW.weight USING ERRCODE='P0001';
    END IF;
    UPDATE public.section_shrinkage_inventory
      SET total_weight = total_weight - NEW.weight, updated_at = now()
      WHERE id = v_id;
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

  -- Shrinkage destination: add to shrinkage_inventory
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

-- 5) Update reverse_movement_inventory to handle shrinkage type
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
    SELECT id INTO v_id FROM public.section_shrinkage_inventory
      WHERE section_id = OLD.from_id AND metal_id = OLD.metal_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_shrinkage_inventory
        SET total_weight = total_weight + OLD.weight, updated_at = now()
        WHERE id = v_id;
    ELSE
      INSERT INTO public.section_shrinkage_inventory(section_id, metal_id, total_weight)
      VALUES (OLD.from_id, OLD.metal_id, OLD.weight);
    END IF;
  END IF;
  RETURN OLD;
END$function$;

-- 6) section_available_loss_999 now reads from shrinkage_inventory
CREATE OR REPLACE FUNCTION public.section_available_loss_999(p_section_id uuid, p_metal_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT GREATEST(
    COALESCE((SELECT total_weight FROM public.section_shrinkage_inventory
              WHERE section_id=p_section_id AND metal_id=p_metal_id), 0)
    - COALESCE((SELECT SUM(ros.initial_loss_999 - ros.recovered_999 - ros.waste_999)
                FROM public.recovery_operation_sections ros
                JOIN public.recovery_operations ro ON ro.id = ros.operation_id
                WHERE ro.status='open' AND ros.section_id=p_section_id AND ros.metal_id=p_metal_id), 0)
  , 0)
$function$;

-- 7) Update work_order_apply_shrinkage: instead of mutating section_inventory 999 row,
--    do conversion bookkeeping then create a movement section→shrinkage for the pure 999 amount.
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
  v_allow_karat_change boolean := false;
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
  v_employee text;
BEGIN
  SELECT to_section_id, shift_id INTO v_section, v_shift_id FROM public.work_orders WHERE id = p_work_order_id;
  IF v_section IS NULL THEN
    RAISE EXCEPTION 'أمر الشغل غير موجود';
  END IF;

  -- Need an OPEN shift for the shrinkage movement. If work_order's original shift is closed, find an open one.
  SELECT id INTO v_shift_id FROM public.shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1;
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'يجب وجود شيفت مفتوح لتسجيل حركة الخسية' USING ERRCODE='P0001';
  END IF;

  SELECT kind INTO v_kind FROM public.manufacturing_sections WHERE id = v_section;
  SELECT COALESCE(allow_karat_change, false) INTO v_allow_karat_change
  FROM public.section_settings WHERE section_id = v_section;
  IF v_allow_karat_change IS NULL THEN v_allow_karat_change := false; END IF;

  -- Zero-count rows in counted categories: convert remaining pure to shrinkage movement
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

    -- Deduct fully from section inventory
    UPDATE public.section_inventory
      SET total_weight = 0,
          total_count = 0,
          updated_at = now()
      WHERE id = r.id;

    -- Create movement section→shrinkage for the pure 999 portion
    INSERT INTO public.movements(
      from_type, from_id, to_type, to_id, metal_id, karat, weight,
      category_id, count, work_order_id, shift_id, employee_name
    ) VALUES (
      'section', v_section, 'shrinkage', v_section, r.metal_id, '999', v_zero_count_pure,
      NULL, NULL, p_work_order_id, v_shift_id, 'تحييف تلقائي'
    );
    -- Above movement triggers will fail trying to deduct from section_inventory (we already deducted).
    -- So we bypass triggers by manually inserting the shrinkage row, then manually inserting movement.
    -- => Revert: delete the movement and write a raw movement that DOESN'T trigger inventory.
  END LOOP;

  -- Note: the previous block uses movements which trigger apply_movement_inventory and would try to
  -- deduct from section_inventory again. We need a different strategy: don't pre-deduct; instead
  -- let the movement do the deduction. For zero-count rows the movement will deduct via flexible logic
  -- if section is flexible, otherwise via exact karat match. But karat='999' from a non-999 row won't match.
  -- So for non-flexible sections we must do the karat conversion manually before creating the movement.

  -- The above is a sketch; the actual production logic is below.
  RETURN v_results;
END
$function$;

-- 8) Replace with a clean, correct implementation (the sketch above is overwritten here)
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
  v_allow_karat_change boolean := false;
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
BEGIN
  SELECT to_section_id INTO v_section FROM public.work_orders WHERE id = p_work_order_id;
  IF v_section IS NULL THEN RAISE EXCEPTION 'أمر الشغل غير موجود'; END IF;

  SELECT id INTO v_shift_id FROM public.shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1;
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'يجب وجود شيفت مفتوح لتسجيل حركات الخسية' USING ERRCODE='P0001';
  END IF;

  SELECT kind INTO v_kind FROM public.manufacturing_sections WHERE id = v_section;
  SELECT COALESCE(allow_karat_change, false) INTO v_allow_karat_change
  FROM public.section_settings WHERE section_id = v_section;
  IF v_allow_karat_change IS NULL THEN v_allow_karat_change := false; END IF;

  -- Zero-count rows in counted categories: deduct karat row, push pure 999 to shrinkage_inventory directly,
  -- and create a movement (we manually handle inventory because mixed-karat to 999 single movement is awkward).
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

    -- Deduct from section inventory directly
    UPDATE public.section_inventory
      SET total_weight = 0, total_count = 0, updated_at = now()
      WHERE id = r.id;
    -- Add to shrinkage inventory directly
    SELECT id INTO v_inv_id FROM public.section_shrinkage_inventory
      WHERE section_id = v_section AND metal_id = r.metal_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_shrinkage_inventory
        SET total_weight = total_weight + v_zero_count_pure, updated_at = now()
        WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.section_shrinkage_inventory(section_id, metal_id, total_weight)
      VALUES (v_section, r.metal_id, v_zero_count_pure);
    END IF;

    -- Record the movement WITHOUT triggering inventory side-effects by temporarily disabling triggers
    -- on this single insert isn't practical; instead we insert a "marker" movement using a NULL trick:
    -- We'll insert with from_type/to_type = 'shrinkage'/'shrinkage' so the from-side deducts and to-side adds, NETting to zero.
    -- Then we insert a SECOND movement section→shrinkage for accounting only. Both still mutate inventory.
    -- The cleanest answer: insert the real movement and reverse our manual changes BEFORE triggers run.
    -- Reverse our manual updates so the trigger logic does the work:
    UPDATE public.section_shrinkage_inventory
      SET total_weight = total_weight - v_zero_count_pure, updated_at = now()
      WHERE section_id = v_section AND metal_id = r.metal_id;
    -- Re-add to section_inventory the karat row temporarily so movement (karat=r.karat) can deduct
    UPDATE public.section_inventory
      SET total_weight = r.total_weight, updated_at = now()
      WHERE id = r.id;

    -- Insert TWO movements:
    --  (a) section(karat=r.karat, weight=r.total_weight) → shrinkage (logically, but to_type shrinkage requires karat 999)
    -- Since the constraint requires karat 999 for shrinkage, we instead do:
    --  Step 1: section(karat) → section(999) conversion - represented by adjusting inventory directly (no movement needed for an in-section conversion)
    --  Step 2: section(999) → shrinkage(999) movement
    -- Apply Step 1 manually:
    UPDATE public.section_inventory
      SET total_weight = 0, total_count = 0, updated_at = now()
      WHERE id = r.id;
    -- Add temporary 999 row in section so movement can deduct it
    INSERT INTO public.section_inventory(section_id, metal_id, karat, category_id, total_weight, total_count)
    VALUES (v_section, r.metal_id, '999', NULL, v_zero_count_pure, NULL);

    -- Step 2: movement section(999) → shrinkage
    INSERT INTO public.movements(
      from_type, from_id, to_type, to_id, metal_id, karat, weight,
      category_id, count, work_order_id, shift_id, employee_name
    ) VALUES (
      'section', v_section, 'shrinkage', v_section, r.metal_id, '999', v_zero_count_pure,
      NULL, NULL, p_work_order_id, v_shift_id, 'تحييف تلقائي'
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
      IF v_pure_missing <= 0.0001 THEN CONTINUE; END IF;

      -- Convert mixed karat rows in section to a 999 row of size v_pure_missing (manual bookkeeping)
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

      v_pure_missing := v_pure_in - v_pure_out - v_pure_already;

      -- Add temporary 999 row in section so the movement can deduct it
      SELECT id INTO v_inv_id FROM public.section_inventory
        WHERE section_id = v_section AND metal_id = v_metal.metal_id AND karat = '999' AND category_id IS NULL FOR UPDATE;
      IF FOUND THEN
        UPDATE public.section_inventory
          SET total_weight = total_weight + v_pure_missing, updated_at = now()
          WHERE id = v_inv_id;
      ELSE
        INSERT INTO public.section_inventory(section_id, metal_id, karat, category_id, total_weight, total_count)
        VALUES (v_section, v_metal.metal_id, '999', NULL, v_pure_missing, NULL);
      END IF;

      -- Movement section(999) → shrinkage
      INSERT INTO public.movements(
        from_type, from_id, to_type, to_id, metal_id, karat, weight,
        category_id, count, work_order_id, shift_id, employee_name
      ) VALUES (
        'section', v_section, 'shrinkage', v_section, v_metal.metal_id, '999', v_pure_missing,
        NULL, NULL, p_work_order_id, v_shift_id, 'تحييف تلقائي'
      );

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

  -- Manufacturing logic (per karat)
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
    IF v_missing <= 0.0001 THEN CONTINUE; END IF;

    v_pure := round((v_missing * (r.karat::numeric / 1000.0))::numeric, 4);

    -- Deduct missing karat directly from section_inventory
    SELECT id, total_weight INTO v_inv_id, v_existing
      FROM public.section_inventory
      WHERE section_id=v_section AND metal_id=r.metal_id AND karat IS NOT DISTINCT FROM r.karat
      FOR UPDATE;
    IF NOT FOUND OR v_existing < v_missing - 0.0001 THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ في القسم لتطبيق تحييف العيار %', r.karat;
    END IF;
    UPDATE public.section_inventory SET total_weight = total_weight - v_missing, updated_at = now() WHERE id = v_inv_id;

    -- Add temp 999 row so movement can deduct it
    SELECT id INTO v_inv_id FROM public.section_inventory
      WHERE section_id=v_section AND metal_id=r.metal_id AND karat='999' AND category_id IS NULL FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_inventory SET total_weight = total_weight + v_pure, updated_at = now() WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.section_inventory(section_id, metal_id, karat, category_id, total_weight, total_count)
      VALUES (v_section, r.metal_id, '999', NULL, v_pure, NULL);
    END IF;

    -- Movement section(999) → shrinkage
    INSERT INTO public.movements(
      from_type, from_id, to_type, to_id, metal_id, karat, weight,
      category_id, count, work_order_id, shift_id, employee_name
    ) VALUES (
      'section', v_section, 'shrinkage', v_section, r.metal_id, '999', v_pure,
      NULL, NULL, p_work_order_id, v_shift_id, 'تحييف تلقائي'
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

-- 9) Update recovery_add_entry: movement is now shrinkage→vault
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

  -- Movement shrinkage(section) → vault
  INSERT INTO public.movements(
    from_type, from_id, to_type, to_id, metal_id, karat, weight,
    category_id, count, shift_id, employee_name
  ) VALUES (
    'shrinkage', p_section_id, 'vault', p_to_vault_id, p_metal_id, '999', p_weight,
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
END$function$;

-- 10) Update recovery_close: deduct waste from shrinkage_inventory
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
      FROM public.section_shrinkage_inventory
      WHERE section_id = v_ros.section_id AND metal_id = v_ros.metal_id
      FOR UPDATE;
      IF NOT FOUND OR v_existing < v_waste - 0.0001 THEN
        RAISE EXCEPTION 'الرصيد غير كافٍ في خسيات القسم لتسجيل الهالك' USING ERRCODE='P0001';
      END IF;
      UPDATE public.section_shrinkage_inventory
        SET total_weight = total_weight - v_waste, updated_at = now()
        WHERE id = v_inv_id;

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

-- 11) recovery_open: read from shrinkage_inventory instead of section_inventory 999/null
CREATE OR REPLACE FUNCTION public.recovery_open(p_section_ids uuid[], p_shift_id uuid, p_employee_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    FOR v_metal IN
      SELECT ssi.metal_id
      FROM public.section_shrinkage_inventory ssi
      WHERE ssi.section_id = v_section AND ssi.total_weight > 0.0001
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
END$function$;
