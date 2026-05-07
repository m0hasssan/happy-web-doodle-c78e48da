
-- Track shrinkage applied per work order / metal / karat
CREATE TABLE public.work_order_shrinkage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  metal_id uuid NOT NULL,
  karat text NOT NULL,
  missing_weight numeric NOT NULL,
  pure_999_weight numeric NOT NULL,
  section_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_order_shrinkage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view shrinkage"
ON public.work_order_shrinkage
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Insert shrinkage authenticated"
ON public.work_order_shrinkage
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX idx_wo_shrinkage_wo ON public.work_order_shrinkage(work_order_id);

-- RPC: compute remaining missing per (metal,karat) of a work order and apply shrinkage to section as 999
CREATE OR REPLACE FUNCTION public.work_order_apply_shrinkage(p_work_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_section uuid;
  v_pure numeric;
  v_inv_id uuid;
  v_existing numeric;
  v_already numeric;
  v_missing numeric;
  v_results jsonb := '[]'::jsonb;
BEGIN
  SELECT to_section_id INTO v_section FROM public.work_orders WHERE id = p_work_order_id;
  IF v_section IS NULL THEN
    RAISE EXCEPTION 'أمر الشغل غير موجود';
  END IF;

  FOR r IN
    SELECT metal_id, karat,
      COALESCE(SUM(CASE WHEN to_type='section'   AND to_id=v_section   THEN weight ELSE 0 END),0)
    - COALESCE(SUM(CASE WHEN from_type='section' AND from_id=v_section THEN weight ELSE 0 END),0)
        AS net_out
    FROM public.movements
    WHERE work_order_id = p_work_order_id
    GROUP BY metal_id, karat
  LOOP
    IF r.karat IS NULL OR r.karat = '999' THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(missing_weight),0) INTO v_already
      FROM public.work_order_shrinkage
      WHERE work_order_id=p_work_order_id AND metal_id=r.metal_id AND karat=r.karat;

    v_missing := r.net_out - v_already;
    IF v_missing <= 0.0001 THEN CONTINUE; END IF;

    v_pure := round((v_missing * (r.karat::numeric / 1000.0))::numeric, 4);

    SELECT id, total_weight INTO v_inv_id, v_existing
      FROM public.section_inventory
      WHERE section_id=v_section AND metal_id=r.metal_id AND karat IS NOT DISTINCT FROM r.karat
      FOR UPDATE;
    IF NOT FOUND OR v_existing < v_missing - 0.0001 THEN
      RAISE EXCEPTION 'الرصيد غير كافٍ في القسم لتطبيق تحييف العيار %', r.karat;
    END IF;
    UPDATE public.section_inventory SET total_weight = total_weight - v_missing, updated_at = now() WHERE id = v_inv_id;

    SELECT id INTO v_inv_id FROM public.section_inventory
      WHERE section_id=v_section AND metal_id=r.metal_id AND karat='999' FOR UPDATE;
    IF FOUND THEN
      UPDATE public.section_inventory SET total_weight = total_weight + v_pure, updated_at = now() WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.section_inventory(section_id, metal_id, karat, total_weight)
      VALUES (v_section, r.metal_id, '999', v_pure);
    END IF;

    INSERT INTO public.work_order_shrinkage(work_order_id, metal_id, karat, missing_weight, pure_999_weight, section_id)
    VALUES (p_work_order_id, r.metal_id, r.karat, v_missing, v_pure, v_section);

    v_results := v_results || jsonb_build_object(
      'metal_id', r.metal_id, 'karat', r.karat,
      'missing', v_missing, 'pure_999', v_pure
    );
  END LOOP;

  RETURN v_results;
END$$;
