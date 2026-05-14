-- Generic rounding trigger function (rounds specified columns to 2 decimals)
CREATE OR REPLACE FUNCTION public.round_weight_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  col TEXT;
  cols TEXT[] := TG_ARGV;
  rec JSONB := to_jsonb(NEW);
BEGIN
  FOREACH col IN ARRAY cols LOOP
    IF rec ? col AND (rec ->> col) IS NOT NULL THEN
      rec := jsonb_set(rec, ARRAY[col], to_jsonb(round((rec ->> col)::numeric, 2)));
    END IF;
  END LOOP;
  NEW := jsonb_populate_record(NEW, rec);
  RETURN NEW;
END;
$$;

-- movements
DROP TRIGGER IF EXISTS trg_round_movements_weight ON public.movements;
CREATE TRIGGER trg_round_movements_weight
BEFORE INSERT OR UPDATE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.round_weight_columns('weight');

-- recovery_entries
DROP TRIGGER IF EXISTS trg_round_recovery_entries ON public.recovery_entries;
CREATE TRIGGER trg_round_recovery_entries
BEFORE INSERT OR UPDATE ON public.recovery_entries
FOR EACH ROW EXECUTE FUNCTION public.round_weight_columns('weight_999');

-- vault_inventory
DROP TRIGGER IF EXISTS trg_round_vault_inventory ON public.vault_inventory;
CREATE TRIGGER trg_round_vault_inventory
BEFORE INSERT OR UPDATE ON public.vault_inventory
FOR EACH ROW EXECUTE FUNCTION public.round_weight_columns('total_weight');

-- section_inventory
DROP TRIGGER IF EXISTS trg_round_section_inventory ON public.section_inventory;
CREATE TRIGGER trg_round_section_inventory
BEFORE INSERT OR UPDATE ON public.section_inventory
FOR EACH ROW EXECUTE FUNCTION public.round_weight_columns('total_weight');

-- section_shrinkage_inventory
DROP TRIGGER IF EXISTS trg_round_section_shrinkage_inventory ON public.section_shrinkage_inventory;
CREATE TRIGGER trg_round_section_shrinkage_inventory
BEFORE INSERT OR UPDATE ON public.section_shrinkage_inventory
FOR EACH ROW EXECUTE FUNCTION public.round_weight_columns('total_weight');

-- work_order_shrinkage
DROP TRIGGER IF EXISTS trg_round_work_order_shrinkage ON public.work_order_shrinkage;
CREATE TRIGGER trg_round_work_order_shrinkage
BEFORE INSERT OR UPDATE ON public.work_order_shrinkage
FOR EACH ROW EXECUTE FUNCTION public.round_weight_columns('pure_999_weight', 'missing_weight');

-- recovery_operation_sections
DROP TRIGGER IF EXISTS trg_round_recovery_op_sections ON public.recovery_operation_sections;
CREATE TRIGGER trg_round_recovery_op_sections
BEFORE INSERT OR UPDATE ON public.recovery_operation_sections
FOR EACH ROW EXECUTE FUNCTION public.round_weight_columns('initial_loss_999', 'recovered_999', 'waste_999');