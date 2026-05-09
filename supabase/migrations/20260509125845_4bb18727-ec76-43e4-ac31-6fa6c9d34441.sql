-- 1) Add hierarchy columns
ALTER TABLE public.metal_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.metal_categories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_metal_categories_parent ON public.metal_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_metal_categories_metal_parent ON public.metal_categories(metal_id, parent_id);

-- 2) Validate hierarchy + count rule
CREATE OR REPLACE FUNCTION public.validate_metal_category()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_parent_metal uuid;
  v_parent_requires boolean;
  cur uuid;
  hops int := 0;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    -- Cycle detection
    cur := NEW.parent_id;
    WHILE cur IS NOT NULL LOOP
      IF cur = NEW.id THEN
        RAISE EXCEPTION 'لا يمكن أن يكون التصنيف تابعاً لنفسه' USING ERRCODE='P0001';
      END IF;
      hops := hops + 1;
      IF hops > 50 THEN
        RAISE EXCEPTION 'تسلسل التصنيفات عميق جداً' USING ERRCODE='P0001';
      END IF;
      SELECT parent_id INTO cur FROM public.metal_categories WHERE id = cur;
    END LOOP;

    SELECT metal_id, requires_count INTO v_parent_metal, v_parent_requires
      FROM public.metal_categories WHERE id = NEW.parent_id;
    IF v_parent_metal IS NULL THEN
      RAISE EXCEPTION 'التصنيف الأب غير موجود' USING ERRCODE='P0001';
    END IF;
    IF NEW.metal_id IS DISTINCT FROM v_parent_metal THEN
      NEW.metal_id := v_parent_metal;
    END IF;
    IF v_parent_requires AND NOT NEW.requires_count THEN
      RAISE EXCEPTION 'يجب أن يطلب التصنيف الفرعي العدد لأن التصنيف الأعلى يطلبه' USING ERRCODE='P0001';
    END IF;
    IF NOT v_parent_requires AND NEW.requires_count THEN
      RAISE EXCEPTION 'لا يمكن أن يطلب التصنيف الفرعي العدد بينما التصنيف الأعلى لا يطلبه' USING ERRCODE='P0001';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.requires_count IS DISTINCT FROM NEW.requires_count THEN
    IF NEW.requires_count THEN
      IF EXISTS(SELECT 1 FROM public.metal_categories WHERE parent_id = NEW.id AND requires_count = false) THEN
        RAISE EXCEPTION 'لا يمكن تفعيل العدد بينما توجد تصنيفات فرعية لا تطلب العدد. عدّلها أولاً.' USING ERRCODE='P0001';
      END IF;
    ELSE
      IF EXISTS(SELECT 1 FROM public.metal_categories WHERE parent_id = NEW.id AND requires_count = true) THEN
        RAISE EXCEPTION 'لا يمكن تعطيل العدد بينما توجد تصنيفات فرعية تطلب العدد. عدّلها أولاً.' USING ERRCODE='P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_validate_metal_category ON public.metal_categories;
CREATE TRIGGER trg_validate_metal_category
BEFORE INSERT OR UPDATE ON public.metal_categories
FOR EACH ROW EXECUTE FUNCTION public.validate_metal_category();

-- 3) Guard delete: no children, no usage
CREATE OR REPLACE FUNCTION public.guard_metal_category_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.metal_categories WHERE parent_id = OLD.id) THEN
    RAISE EXCEPTION 'لا يمكن حذف تصنيف يحتوي على تصنيفات فرعية' USING ERRCODE='P0001';
  END IF;
  IF EXISTS(SELECT 1 FROM public.movements WHERE category_id = OLD.id) THEN
    RAISE EXCEPTION 'لا يمكن حذف تصنيف مستخدم في الحركات' USING ERRCODE='P0001';
  END IF;
  IF EXISTS(SELECT 1 FROM public.vault_inventory WHERE category_id = OLD.id AND total_weight > 0) THEN
    RAISE EXCEPTION 'لا يمكن حذف تصنيف له رصيد في الخزن' USING ERRCODE='P0001';
  END IF;
  IF EXISTS(SELECT 1 FROM public.section_inventory WHERE category_id = OLD.id AND total_weight > 0) THEN
    RAISE EXCEPTION 'لا يمكن حذف تصنيف له رصيد في الأقسام' USING ERRCODE='P0001';
  END IF;
  RETURN OLD;
END$$;

DROP TRIGGER IF EXISTS trg_guard_metal_category_delete ON public.metal_categories;
CREATE TRIGGER trg_guard_metal_category_delete
BEFORE DELETE ON public.metal_categories
FOR EACH ROW EXECUTE FUNCTION public.guard_metal_category_delete();

-- 4) Enforce leaf-only category in movements via apply_movement_inventory
CREATE OR REPLACE FUNCTION public.apply_movement_inventory()
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
  -- Leaf-only category check: if a category is provided it must have no children
  IF NEW.category_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.metal_categories WHERE parent_id = NEW.category_id) THEN
      RAISE EXCEPTION 'يجب اختيار التصنيف الفرعي النهائي (التصنيف المختار يحتوي على تصنيفات فرعية)' USING ERRCODE='P0001';
    END IF;
  END IF;

  IF NEW.from_type = 'section' THEN
    SELECT (kind = 'processing') INTO v_from_processing FROM public.manufacturing_sections WHERE id = NEW.from_id;
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
    SELECT id, total_weight, total_count INTO v_id, v_existing, v_existing_count FROM public.section_inventory
     WHERE section_id=NEW.from_id AND metal_id=NEW.metal_id
       AND karat IS NOT DISTINCT FROM NEW.karat
       AND category_id IS NOT DISTINCT FROM NEW.category_id
     FOR UPDATE;
    IF NOT FOUND OR v_existing < NEW.weight THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ في القسم (المتاح: %, المطلوب: %)', COALESCE(v_existing,0), NEW.weight USING ERRCODE='P0001';
    END IF;
    IF NEW.count IS NOT NULL AND NOT v_from_processing THEN
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
              WHEN v_from_processing AND NEW.count IS NOT NULL
                THEN GREATEST(COALESCE(total_count,0) - NEW.count, 0)
              ELSE total_count
            END,
            updated_at=now()
        WHERE id=v_id;
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