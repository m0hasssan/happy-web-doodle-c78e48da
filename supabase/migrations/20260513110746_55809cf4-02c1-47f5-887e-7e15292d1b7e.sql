CREATE OR REPLACE FUNCTION public.work_order_update_holder_on_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.work_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Shrinkage is an accounting destination for lost weight, not a physical
  -- holder of the work order. Keep the holder as the last real vault/section.
  IF NEW.to_type = 'shrinkage' THEN
    UPDATE public.work_orders
      SET temp_returned_to_vault = (current_holder_type = 'vault'),
          updated_at = now()
      WHERE id = NEW.work_order_id;
    RETURN NEW;
  END IF;

  UPDATE public.work_orders
    SET current_holder_type = NEW.to_type,
        current_holder_id   = NEW.to_id,
        temp_returned_to_vault = (NEW.to_type = 'vault'),
        updated_at = now()
    WHERE id = NEW.work_order_id;
  RETURN NEW;
END$function$;