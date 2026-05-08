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
    -- Processing sections: skip count enforcement and don't track count in section inventory
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
      UPDATE public.section_inventory SET total_weight=total_weight-NEW.weight, updated_at=now() WHERE id=v_id;
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
            total_count = CASE WHEN NEW.count IS NOT NULL THEN COALESCE(total_count,0)+NEW.count ELSE total_count END,
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
              WHEN v_to_processing THEN total_count
              WHEN NEW.count IS NOT NULL THEN COALESCE(total_count,0)+NEW.count
              ELSE total_count
            END,
            updated_at=now()
        WHERE id=v_id;
    ELSE
      INSERT INTO public.section_inventory(section_id,metal_id,karat,category_id,total_weight,total_count)
      VALUES (NEW.to_id,NEW.metal_id,NEW.karat,NEW.category_id,NEW.weight,
              CASE WHEN v_to_processing THEN NULL ELSE NEW.count END);
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
  RETURN OLD;
END$function$;

-- Backfill: clear total_count from existing processing-section inventory rows
UPDATE public.section_inventory si
SET total_count = NULL, updated_at = now()
FROM public.manufacturing_sections ms
WHERE ms.id = si.section_id AND ms.kind = 'processing' AND si.total_count IS NOT NULL;