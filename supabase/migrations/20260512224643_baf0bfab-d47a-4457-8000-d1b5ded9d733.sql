
-- Update admin_reset_movements to also clear shrinkage and recovery data
CREATE OR REPLACE FUNCTION public.admin_reset_movements()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  ALTER TABLE public.movements DISABLE TRIGGER trg_reverse_movement_inventory;
  DELETE FROM public.movements WHERE true;
  ALTER TABLE public.movements ENABLE TRIGGER trg_reverse_movement_inventory;
  DELETE FROM public.recovery_entries WHERE true;
  DELETE FROM public.recovery_operation_sections WHERE true;
  DELETE FROM public.recovery_operations WHERE true;
  DELETE FROM public.work_order_shrinkage WHERE true;
  DELETE FROM public.section_shrinkage_inventory WHERE true;
  DELETE FROM public.vault_inventory WHERE true;
  DELETE FROM public.section_inventory WHERE true;
  DELETE FROM public.work_orders WHERE true;
  DELETE FROM public.shifts WHERE true;
END$function$;

-- Update admin_delete_all_data similarly
CREATE OR REPLACE FUNCTION public.admin_delete_all_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  ALTER TABLE public.movements DISABLE TRIGGER trg_reverse_movement_inventory;
  ALTER TABLE public.vaults DISABLE TRIGGER trg_guard_vault_delete;
  ALTER TABLE public.manufacturing_sections DISABLE TRIGGER trg_guard_section_delete;
  DELETE FROM public.movements WHERE true;
  DELETE FROM public.recovery_entries WHERE true;
  DELETE FROM public.recovery_operation_sections WHERE true;
  DELETE FROM public.recovery_operations WHERE true;
  DELETE FROM public.work_order_shrinkage WHERE true;
  DELETE FROM public.section_shrinkage_inventory WHERE true;
  DELETE FROM public.work_orders WHERE true;
  DELETE FROM public.shifts WHERE true;
  DELETE FROM public.vault_inventory WHERE true;
  DELETE FROM public.section_inventory WHERE true;
  DELETE FROM public.vault_metals WHERE true;
  DELETE FROM public.section_metals WHERE true;
  DELETE FROM public.vaults WHERE true;
  DELETE FROM public.manufacturing_sections WHERE true;
  DELETE FROM public.suppliers WHERE true;
  ALTER TABLE public.movements ENABLE TRIGGER trg_reverse_movement_inventory;
  ALTER TABLE public.vaults ENABLE TRIGGER trg_guard_vault_delete;
  ALTER TABLE public.manufacturing_sections ENABLE TRIGGER trg_guard_section_delete;
END$function$;

-- Clear current shrinkage and recovery data + any leftover inventory
DELETE FROM public.recovery_entries WHERE true;
DELETE FROM public.recovery_operation_sections WHERE true;
DELETE FROM public.recovery_operations WHERE true;
DELETE FROM public.work_order_shrinkage WHERE true;
DELETE FROM public.section_shrinkage_inventory WHERE true;
