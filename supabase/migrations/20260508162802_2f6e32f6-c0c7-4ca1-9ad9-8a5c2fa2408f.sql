
-- 1. Add category_id and total_count to inventory tables
ALTER TABLE public.vault_inventory
  ADD COLUMN IF NOT EXISTS category_id uuid NULL REFERENCES public.metal_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_count integer NULL;

ALTER TABLE public.section_inventory
  ADD COLUMN IF NOT EXISTS category_id uuid NULL REFERENCES public.metal_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_count integer NULL;

-- 2. Replace unique indexes to include category_id
DROP INDEX IF EXISTS public.vault_inventory_vault_metal_karat_uq;
CREATE UNIQUE INDEX vault_inventory_vault_metal_karat_cat_uq
  ON public.vault_inventory (vault_id, metal_id, COALESCE(karat,''), COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE UNIQUE INDEX IF NOT EXISTS section_inventory_section_metal_karat_cat_uq
  ON public.section_inventory (section_id, metal_id, COALESCE(karat,''), COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 3. Update apply_movement_inventory: match on category_id, maintain total_count
CREATE OR REPLACE FUNCTION public.apply_movement_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_existing numeric; v_id uuid; v_existing_count integer;
BEGIN
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
    IF NEW.count IS NOT NULL THEN
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
            total_count = CASE WHEN NEW.count IS NOT NULL THEN COALESCE(total_count,0)+NEW.count ELSE total_count END,
            updated_at=now()
        WHERE id=v_id;
    ELSE
      INSERT INTO public.section_inventory(section_id,metal_id,karat,category_id,total_weight,total_count)
      VALUES (NEW.to_id,NEW.metal_id,NEW.karat,NEW.category_id,NEW.weight,NEW.count);
    END IF;
  END IF;
  RETURN NEW;
END$function$;

-- 4. Update reverse_movement_inventory: match on category_id, maintain total_count
CREATE OR REPLACE FUNCTION public.reverse_movement_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_existing numeric; v_id uuid; v_existing_count integer;
BEGIN
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
          total_count = CASE WHEN OLD.count IS NOT NULL THEN COALESCE(total_count,0)-OLD.count ELSE total_count END,
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
            total_count = CASE WHEN OLD.count IS NOT NULL THEN COALESCE(total_count,0)+OLD.count ELSE total_count END,
            updated_at=now()
        WHERE id=v_id;
    ELSE
      INSERT INTO public.section_inventory(section_id,metal_id,karat,category_id,total_weight,total_count)
      VALUES (OLD.from_id,OLD.metal_id,OLD.karat,OLD.category_id,OLD.weight,OLD.count);
    END IF;
  END IF;
  RETURN OLD;
END$function$;
