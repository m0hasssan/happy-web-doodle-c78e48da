
CREATE OR REPLACE FUNCTION public.admin_reset_movements()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  ALTER TABLE public.movements DISABLE TRIGGER trg_reverse_movement_inventory;
  DELETE FROM public.movements;
  ALTER TABLE public.movements ENABLE TRIGGER trg_reverse_movement_inventory;
  DELETE FROM public.vault_inventory;
  DELETE FROM public.section_inventory;
  DELETE FROM public.shifts;
END$$;

REVOKE ALL ON FUNCTION public.admin_reset_movements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_movements() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_all_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  ALTER TABLE public.movements DISABLE TRIGGER trg_reverse_movement_inventory;
  ALTER TABLE public.vaults DISABLE TRIGGER trg_guard_vault_delete;
  ALTER TABLE public.manufacturing_sections DISABLE TRIGGER trg_guard_section_delete;
  DELETE FROM public.movements;
  DELETE FROM public.shifts;
  DELETE FROM public.vault_inventory;
  DELETE FROM public.section_inventory;
  DELETE FROM public.vault_metals;
  DELETE FROM public.section_metals;
  DELETE FROM public.vaults;
  DELETE FROM public.manufacturing_sections;
  DELETE FROM public.suppliers;
  ALTER TABLE public.movements ENABLE TRIGGER trg_reverse_movement_inventory;
  ALTER TABLE public.vaults ENABLE TRIGGER trg_guard_vault_delete;
  ALTER TABLE public.manufacturing_sections ENABLE TRIGGER trg_guard_section_delete;
END$$;

REVOKE ALL ON FUNCTION public.admin_delete_all_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_all_data() TO authenticated;
