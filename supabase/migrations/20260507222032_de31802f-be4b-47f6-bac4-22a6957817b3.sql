
-- Decouple work orders from source vault; track current holder dynamically.
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS current_holder_type text,
  ADD COLUMN IF NOT EXISTS current_holder_id uuid;

-- Backfill current holder based on existing state.
UPDATE public.work_orders
SET current_holder_type = CASE
    WHEN status = 'in_progress' AND temp_returned_to_vault THEN 'vault'
    WHEN status = 'in_progress' AND NOT temp_returned_to_vault THEN 'section'
    WHEN status = 'delivered' THEN 'section'
    ELSE NULL
  END,
  current_holder_id = CASE
    WHEN status = 'in_progress' AND temp_returned_to_vault THEN from_vault_id
    WHEN status = 'in_progress' AND NOT temp_returned_to_vault THEN to_section_id
    WHEN status = 'delivered' THEN to_section_id
    ELSE NULL
  END
WHERE current_holder_type IS NULL;

-- Validation constraint
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_holder_type_check;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_holder_type_check
  CHECK (current_holder_type IS NULL OR current_holder_type IN ('vault','section'));

-- Drop old RPCs (replaced by direct movement inserts).
DROP FUNCTION IF EXISTS public.work_order_temp_return(uuid);
DROP FUNCTION IF EXISTS public.work_order_send_back_to_section(uuid);

-- Trigger: when a movement linked to a work_order is inserted, update the order's current holder.
CREATE OR REPLACE FUNCTION public.work_order_update_holder_on_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.work_order_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.work_orders
    SET current_holder_type = NEW.to_type,
        current_holder_id   = NEW.to_id,
        temp_returned_to_vault = (NEW.to_type = 'vault'),
        updated_at = now()
    WHERE id = NEW.work_order_id;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_work_order_update_holder ON public.movements;
CREATE TRIGGER trg_work_order_update_holder
AFTER INSERT ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.work_order_update_holder_on_movement();
