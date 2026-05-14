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

  -- Reset code sequences so new records start from 1 again
  PERFORM setval('public.movements_code_seq', 1, false);
  PERFORM setval('public.work_orders_code_seq', 1, false);
  PERFORM setval('public.recovery_operations_code_seq', 1, false);
  PERFORM setval('public.shifts_code_seq', 1, false);
END$function$;