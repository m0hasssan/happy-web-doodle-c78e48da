
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  user_name text,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb
);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_table_name_idx ON public.activity_log (table_name);
CREATE INDEX IF NOT EXISTS activity_log_user_id_idx ON public.activity_log (user_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View activity_log with permission" ON public.activity_log;
CREATE POLICY "View activity_log with permission"
ON public.activity_log
FOR SELECT
TO authenticated
USING (has_permission(auth.uid(), 'view_activity_log'::app_permission) OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_record_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSE
    v_new := to_jsonb(NEW);
  END IF;

  BEGIN
    v_record_id := (COALESCE(v_new, v_old)->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_record_id := NULL;
  END;

  INSERT INTO public.activity_log (user_id, user_name, action, table_name, record_id, old_data, new_data)
  VALUES (v_user_id, COALESCE(v_user_name, 'النظام'), TG_OP, TG_TABLE_NAME, v_record_id, v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_activity() FROM PUBLIC, anon;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'vaults','vault_inventory','vault_metals','vault_item_adjustments',
    'manufacturing_sections','section_inventory','section_metals','section_settings','section_metal_rules','section_shrinkage_inventory',
    'movements','suppliers','work_orders','work_order_shrinkage',
    'shifts','metals','metal_karats','metal_categories',
    'user_roles','user_permissions','profiles','system_settings',
    'recovery_operations','recovery_entries','recovery_operation_sections'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_log_activity ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_log_activity AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_activity()', t);
  END LOOP;
END $$;
