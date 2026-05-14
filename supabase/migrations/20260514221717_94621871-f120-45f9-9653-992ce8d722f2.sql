
-- 1) Audit table for vault item adjustments (no movement entry)
CREATE TABLE public.vault_item_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL,
  vault_id uuid NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
  metal_id uuid NOT NULL,
  karat text,
  category_id uuid,
  delta_weight numeric NOT NULL DEFAULT 0,
  delta_count integer,
  shift_id uuid,
  created_by_user_id uuid,
  employee_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vault_item_adjustments_vault ON public.vault_item_adjustments(vault_id);
CREATE INDEX idx_vault_item_adjustments_adj ON public.vault_item_adjustments(adjustment_id);

ALTER TABLE public.vault_item_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View vault_item_adjustments with permission"
  ON public.vault_item_adjustments FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'view_vault_data', vault_id)
    OR public.has_permission(auth.uid(), 'access_vault', vault_id)
  );

CREATE POLICY "Insert vault_item_adjustments admin"
  ON public.vault_item_adjustments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Function: apply adjustments atomically while preserving net 999 weight
CREATE OR REPLACE FUNCTION public.apply_vault_item_adjustment(
  p_vault_id uuid,
  p_shift_id uuid,
  p_employee_name text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_adj_id uuid := gen_random_uuid();
  v_ended timestamptz;
  v_current_pure numeric := 0;
  v_target_pure numeric := 0;
  v_tolerance numeric := 0.001;
  v_inv record;
  v_item jsonb;
  v_key text;
  v_metal uuid;
  v_karat text;
  v_cat uuid;
  v_w numeric;
  v_c integer;
  v_kn numeric;
  v_old_w numeric;
  v_old_c integer;
  v_id uuid;
  current_map jsonb := '{}'::jsonb;
  target_map jsonb := '{}'::jsonb;
  k text;
BEGIN
  -- Permissions: same as vault entry
  IF NOT (public.has_permission(auth.uid(), 'create_vault_entry', p_vault_id)
          OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل أصناف هذه الخزنة' USING ERRCODE='42501';
  END IF;

  -- Shift required
  IF p_shift_id IS NULL THEN
    RAISE EXCEPTION 'يجب وجود شيفت مفتوح' USING ERRCODE='P0001';
  END IF;
  SELECT ended_at INTO v_ended FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الشيفت غير موجود' USING ERRCODE='P0001'; END IF;
  IF v_ended IS NOT NULL THEN
    RAISE EXCEPTION 'لا يمكن تنفيذ التعديل على شيفت منتهي' USING ERRCODE='P0001';
  END IF;

  -- Build CURRENT map from vault_inventory (positive rows only)
  FOR v_inv IN
    SELECT metal_id, karat, category_id, total_weight, total_count
    FROM public.vault_inventory
    WHERE vault_id = p_vault_id AND total_weight > 0.0001
    FOR UPDATE
  LOOP
    IF v_inv.karat IS NULL THEN
      RAISE EXCEPTION 'لا يمكن تعديل أصناف بدون عيار' USING ERRCODE='P0001';
    END IF;
    BEGIN v_kn := v_inv.karat::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'عيار غير رقمي: %', v_inv.karat USING ERRCODE='P0001';
    END;
    v_current_pure := v_current_pure + (v_inv.total_weight * v_kn / 999.0);
    v_key := v_inv.metal_id::text || '|' || v_inv.karat || '|' || COALESCE(v_inv.category_id::text, '');
    current_map := current_map || jsonb_build_object(v_key, jsonb_build_object(
      'metal_id', v_inv.metal_id,
      'karat', v_inv.karat,
      'category_id', v_inv.category_id,
      'weight', v_inv.total_weight,
      'count', v_inv.total_count
    ));
  END LOOP;

  -- Build TARGET map from p_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_metal := (v_item->>'metal_id')::uuid;
    v_karat := v_item->>'karat';
    v_cat := NULLIF(v_item->>'category_id','')::uuid;
    v_w := (v_item->>'weight')::numeric;
    v_c := NULLIF(v_item->>'count','')::integer;

    IF v_metal IS NULL THEN RAISE EXCEPTION 'المعدن مطلوب' USING ERRCODE='P0001'; END IF;
    IF v_karat IS NULL OR btrim(v_karat) = '' THEN
      RAISE EXCEPTION 'العيار مطلوب' USING ERRCODE='P0001';
    END IF;
    IF v_w IS NULL OR v_w <= 0 THEN
      RAISE EXCEPTION 'الوزن يجب أن يكون أكبر من صفر' USING ERRCODE='P0001';
    END IF;
    -- final-leaf category if provided
    IF v_cat IS NOT NULL AND EXISTS(SELECT 1 FROM public.metal_categories WHERE parent_id = v_cat) THEN
      RAISE EXCEPTION 'يجب اختيار تصنيف فرعي نهائي' USING ERRCODE='P0001';
    END IF;
    BEGIN v_kn := v_karat::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'عيار غير رقمي: %', v_karat USING ERRCODE='P0001';
    END;
    v_target_pure := v_target_pure + (v_w * v_kn / 999.0);

    v_key := v_metal::text || '|' || v_karat || '|' || COALESCE(v_cat::text, '');
    -- accumulate same key
    IF target_map ? v_key THEN
      v_old_w := (target_map->v_key->>'weight')::numeric;
      v_old_c := NULLIF(target_map->v_key->>'count','')::integer;
      target_map := target_map || jsonb_build_object(v_key, jsonb_build_object(
        'metal_id', v_metal, 'karat', v_karat, 'category_id', v_cat,
        'weight', v_old_w + v_w,
        'count', CASE WHEN v_c IS NULL AND v_old_c IS NULL THEN NULL
                      ELSE COALESCE(v_old_c,0) + COALESCE(v_c,0) END
      ));
    ELSE
      target_map := target_map || jsonb_build_object(v_key, jsonb_build_object(
        'metal_id', v_metal, 'karat', v_karat, 'category_id', v_cat,
        'weight', v_w, 'count', v_c
      ));
    END IF;
  END LOOP;

  -- Conservation check
  IF abs(v_current_pure - v_target_pure) > v_tolerance THEN
    RAISE EXCEPTION 'صافي وزن 999 بعد التعديل (%) لا يساوي قبل التعديل (%)',
      round(v_target_pure,4), round(v_current_pure,4) USING ERRCODE='P0001';
  END IF;

  -- Apply: for each key in either map, compute delta and update
  FOR k IN SELECT jsonb_object_keys(current_map || target_map) LOOP
    DECLARE
      cur_w numeric := COALESCE((current_map->k->>'weight')::numeric, 0);
      cur_c integer := NULLIF(current_map->k->>'count','')::integer;
      tgt_w numeric := COALESCE((target_map->k->>'weight')::numeric, 0);
      tgt_c integer := NULLIF(target_map->k->>'count','')::integer;
      d_w numeric;
      d_c integer;
      e_metal uuid;
      e_karat text;
      e_cat uuid;
      src jsonb;
    BEGIN
      src := COALESCE(target_map->k, current_map->k);
      e_metal := (src->>'metal_id')::uuid;
      e_karat := src->>'karat';
      e_cat := NULLIF(src->>'category_id','')::uuid;
      d_w := tgt_w - cur_w;
      IF cur_c IS NULL AND tgt_c IS NULL THEN d_c := NULL;
      ELSE d_c := COALESCE(tgt_c,0) - COALESCE(cur_c,0);
      END IF;

      IF d_w = 0 AND (d_c IS NULL OR d_c = 0) THEN CONTINUE; END IF;

      -- Upsert vault_inventory
      SELECT id INTO v_id FROM public.vault_inventory
        WHERE vault_id = p_vault_id AND metal_id = e_metal
          AND karat IS NOT DISTINCT FROM e_karat
          AND category_id IS NOT DISTINCT FROM e_cat
        FOR UPDATE;
      IF FOUND THEN
        UPDATE public.vault_inventory
          SET total_weight = GREATEST(total_weight + d_w, 0),
              total_count = CASE
                WHEN d_c IS NULL THEN total_count
                ELSE GREATEST(COALESCE(total_count,0) + d_c, 0)
              END,
              updated_at = now()
          WHERE id = v_id;
        DELETE FROM public.vault_inventory
          WHERE id = v_id AND total_weight <= 0.0001 AND COALESCE(total_count,0) = 0;
      ELSE
        IF tgt_w > 0 THEN
          INSERT INTO public.vault_inventory(vault_id, metal_id, karat, category_id, total_weight, total_count)
          VALUES (p_vault_id, e_metal, e_karat, e_cat, tgt_w, tgt_c);
        END IF;
      END IF;

      -- Audit row (use SECURITY DEFINER privilege to insert without RLS clash)
      INSERT INTO public.vault_item_adjustments(
        adjustment_id, vault_id, metal_id, karat, category_id,
        delta_weight, delta_count, shift_id, created_by_user_id, employee_name
      ) VALUES (
        v_adj_id, p_vault_id, e_metal, e_karat, e_cat,
        d_w, d_c, p_shift_id, auth.uid(), p_employee_name
      );
    END;
  END LOOP;

  RETURN v_adj_id;
END$$;

GRANT EXECUTE ON FUNCTION public.apply_vault_item_adjustment(uuid, uuid, text, jsonb) TO authenticated;
