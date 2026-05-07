
-- 1) Audit column
ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

-- 2) BEFORE INSERT trigger: audit + require open shift
CREATE OR REPLACE FUNCTION public.movements_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ended timestamptz;
BEGIN
  IF NEW.created_by_user_id IS NULL THEN NEW.created_by_user_id := auth.uid(); END IF;
  IF NEW.shift_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الحركة ضمن شيفت مفتوح' USING ERRCODE='P0001';
  END IF;
  SELECT ended_at INTO v_ended FROM public.shifts WHERE id = NEW.shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الشيفت غير موجود' USING ERRCODE='P0001'; END IF;
  IF v_ended IS NOT NULL THEN
    RAISE EXCEPTION 'لا يمكن تسجيل حركة على شيفت منتهي' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_movements_before_insert ON public.movements;
CREATE TRIGGER trg_movements_before_insert
  BEFORE INSERT ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.movements_before_insert();

-- 3) Apply inventory atomically on INSERT
CREATE OR REPLACE FUNCTION public.apply_movement_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_existing numeric; v_id uuid;
BEGIN
  IF NEW.from_type = 'vault' THEN
    SELECT id, total_weight INTO v_id, v_existing FROM public.vault_inventory
     WHERE vault_id=NEW.from_id AND metal_id=NEW.metal_id AND karat IS NOT DISTINCT FROM NEW.karat FOR UPDATE;
    IF NOT FOUND OR v_existing < NEW.weight THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ في الخزنة (المتاح: %, المطلوب: %)', COALESCE(v_existing,0), NEW.weight USING ERRCODE='P0001';
    END IF;
    UPDATE public.vault_inventory SET total_weight=total_weight-NEW.weight, updated_at=now() WHERE id=v_id;
  END IF;
  IF NEW.from_type = 'section' THEN
    SELECT id, total_weight INTO v_id, v_existing FROM public.section_inventory
     WHERE section_id=NEW.from_id AND metal_id=NEW.metal_id AND karat IS NOT DISTINCT FROM NEW.karat FOR UPDATE;
    IF NOT FOUND OR v_existing < NEW.weight THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ في القسم (المتاح: %, المطلوب: %)', COALESCE(v_existing,0), NEW.weight USING ERRCODE='P0001';
    END IF;
    UPDATE public.section_inventory SET total_weight=total_weight-NEW.weight, updated_at=now() WHERE id=v_id;
  END IF;
  IF NEW.to_type = 'vault' THEN
    SELECT id INTO v_id FROM public.vault_inventory
     WHERE vault_id=NEW.to_id AND metal_id=NEW.metal_id AND karat IS NOT DISTINCT FROM NEW.karat FOR UPDATE;
    IF FOUND THEN
      UPDATE public.vault_inventory SET total_weight=total_weight+NEW.weight, updated_at=now() WHERE id=v_id;
    ELSE
      INSERT INTO public.vault_inventory(vault_id,metal_id,karat,total_weight) VALUES (NEW.to_id,NEW.metal_id,NEW.karat,NEW.weight);
    END IF;
  END IF;
  IF NEW.to_type = 'section' THEN
    SELECT id INTO v_id FROM public.section_inventory
     WHERE section_id=NEW.to_id AND metal_id=NEW.metal_id AND karat IS NOT DISTINCT FROM NEW.karat FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_inventory SET total_weight=total_weight+NEW.weight, updated_at=now() WHERE id=v_id;
    ELSE
      INSERT INTO public.section_inventory(section_id,metal_id,karat,total_weight) VALUES (NEW.to_id,NEW.metal_id,NEW.karat,NEW.weight);
    END IF;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_apply_movement_inventory ON public.movements;
CREATE TRIGGER trg_apply_movement_inventory
  AFTER INSERT ON public.movements FOR EACH ROW EXECUTE FUNCTION public.apply_movement_inventory();

-- 4) Reverse inventory on DELETE
CREATE OR REPLACE FUNCTION public.reverse_movement_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_existing numeric; v_id uuid;
BEGIN
  IF OLD.to_type = 'vault' THEN
    SELECT id,total_weight INTO v_id,v_existing FROM public.vault_inventory
     WHERE vault_id=OLD.to_id AND metal_id=OLD.metal_id AND karat IS NOT DISTINCT FROM OLD.karat FOR UPDATE;
    IF NOT FOUND OR v_existing < OLD.weight THEN
      RAISE EXCEPTION 'لا يمكن حذف الحركة: الرصيد الحالي أقل من وزن الحركة' USING ERRCODE='P0001';
    END IF;
    UPDATE public.vault_inventory SET total_weight=total_weight-OLD.weight, updated_at=now() WHERE id=v_id;
  END IF;
  IF OLD.to_type = 'section' THEN
    SELECT id,total_weight INTO v_id,v_existing FROM public.section_inventory
     WHERE section_id=OLD.to_id AND metal_id=OLD.metal_id AND karat IS NOT DISTINCT FROM OLD.karat FOR UPDATE;
    IF NOT FOUND OR v_existing < OLD.weight THEN
      RAISE EXCEPTION 'لا يمكن حذف الحركة: الرصيد الحالي أقل من وزن الحركة' USING ERRCODE='P0001';
    END IF;
    UPDATE public.section_inventory SET total_weight=total_weight-OLD.weight, updated_at=now() WHERE id=v_id;
  END IF;
  IF OLD.from_type = 'vault' THEN
    SELECT id INTO v_id FROM public.vault_inventory
     WHERE vault_id=OLD.from_id AND metal_id=OLD.metal_id AND karat IS NOT DISTINCT FROM OLD.karat FOR UPDATE;
    IF FOUND THEN UPDATE public.vault_inventory SET total_weight=total_weight+OLD.weight, updated_at=now() WHERE id=v_id;
    ELSE INSERT INTO public.vault_inventory(vault_id,metal_id,karat,total_weight) VALUES (OLD.from_id,OLD.metal_id,OLD.karat,OLD.weight); END IF;
  END IF;
  IF OLD.from_type = 'section' THEN
    SELECT id INTO v_id FROM public.section_inventory
     WHERE section_id=OLD.from_id AND metal_id=OLD.metal_id AND karat IS NOT DISTINCT FROM OLD.karat FOR UPDATE;
    IF FOUND THEN UPDATE public.section_inventory SET total_weight=total_weight+OLD.weight, updated_at=now() WHERE id=v_id;
    ELSE INSERT INTO public.section_inventory(section_id,metal_id,karat,total_weight) VALUES (OLD.from_id,OLD.metal_id,OLD.karat,OLD.weight); END IF;
  END IF;
  RETURN OLD;
END$$;

DROP TRIGGER IF EXISTS trg_reverse_movement_inventory ON public.movements;
CREATE TRIGGER trg_reverse_movement_inventory
  AFTER DELETE ON public.movements FOR EACH ROW EXECUTE FUNCTION public.reverse_movement_inventory();

-- 5) RLS update for edit/delete movement
DROP POLICY IF EXISTS "Update movements admin only" ON public.movements;
CREATE POLICY "Update movements with permission" ON public.movements
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_movement'));

DROP POLICY IF EXISTS "Delete movements admin only" ON public.movements;
CREATE POLICY "Delete movements with permission" ON public.movements
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'delete_movement'));

-- 6) Guard delete triggers
CREATE OR REPLACE FUNCTION public.guard_vault_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vault_inventory WHERE vault_id=OLD.id AND total_weight>0) THEN
    RAISE EXCEPTION 'لا يمكن حذف الخزنة: تحتوي على أرصدة' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.movements WHERE (from_type='vault' AND from_id=OLD.id) OR (to_type='vault' AND to_id=OLD.id)) THEN
    RAISE EXCEPTION 'لا يمكن حذف الخزنة: مرتبطة بحركات سابقة' USING ERRCODE='P0001';
  END IF;
  RETURN OLD;
END$$;

DROP TRIGGER IF EXISTS trg_guard_vault_delete ON public.vaults;
CREATE TRIGGER trg_guard_vault_delete BEFORE DELETE ON public.vaults
  FOR EACH ROW EXECUTE FUNCTION public.guard_vault_delete();

CREATE OR REPLACE FUNCTION public.guard_section_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.section_inventory WHERE section_id=OLD.id AND total_weight>0) THEN
    RAISE EXCEPTION 'لا يمكن حذف القسم: يحتوي على أرصدة' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.movements WHERE (from_type='section' AND from_id=OLD.id) OR (to_type='section' AND to_id=OLD.id)) THEN
    RAISE EXCEPTION 'لا يمكن حذف القسم: مرتبط بحركات سابقة' USING ERRCODE='P0001';
  END IF;
  RETURN OLD;
END$$;

DROP TRIGGER IF EXISTS trg_guard_section_delete ON public.manufacturing_sections;
CREATE TRIGGER trg_guard_section_delete BEFORE DELETE ON public.manufacturing_sections
  FOR EACH ROW EXECUTE FUNCTION public.guard_section_delete();

-- 7) Tighten SELECT RLS
DROP POLICY IF EXISTS "Authenticated view vault_inventory" ON public.vault_inventory;
CREATE POLICY "View vault_inventory with permission" ON public.vault_inventory
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'view_vault_data', vault_id)
      OR public.has_permission(auth.uid(), 'access_vault', vault_id));

DROP POLICY IF EXISTS "Authenticated view section_inventory" ON public.section_inventory;
CREATE POLICY "View section_inventory with permission" ON public.section_inventory
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'view_section_data', section_id)
      OR public.has_permission(auth.uid(), 'access_section', section_id));

DROP POLICY IF EXISTS "Authenticated view movements" ON public.movements;
CREATE POLICY "View movements with permission" ON public.movements
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'view_movements')
    OR (from_type='vault'   AND public.has_permission(auth.uid(), 'view_vault_movements', from_id))
    OR (to_type  ='vault'   AND public.has_permission(auth.uid(), 'view_vault_movements', to_id))
    OR (from_type='section' AND public.has_permission(auth.uid(), 'view_section_movements', from_id))
    OR (to_type  ='section' AND public.has_permission(auth.uid(), 'view_section_movements', to_id))
    OR public.has_permission(auth.uid(), 'view_supplier_account')
  );
