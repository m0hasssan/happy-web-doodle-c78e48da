CREATE OR REPLACE FUNCTION public.movements_validate_destination_metal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed boolean;
BEGIN
  IF NEW.to_type = 'vault' THEN
    SELECT EXISTS(SELECT 1 FROM public.vault_metals WHERE vault_id = NEW.to_id AND metal_id = NEW.metal_id) INTO allowed;
    IF NOT allowed THEN
      RAISE EXCEPTION 'الخزنة الوجهة لا تقبل هذا المعدن' USING ERRCODE='P0001';
    END IF;
  END IF;
  IF NEW.to_type = 'section' THEN
    SELECT EXISTS(SELECT 1 FROM public.section_metals WHERE section_id = NEW.to_id AND metal_id = NEW.metal_id) INTO allowed;
    IF NOT allowed THEN
      RAISE EXCEPTION 'القسم الوجهة لا يقبل هذا المعدن' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_movements_validate_destination_metal ON public.movements;
CREATE TRIGGER trg_movements_validate_destination_metal
BEFORE INSERT ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.movements_validate_destination_metal();