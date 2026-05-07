
-- Add resource_id to user_permissions for per-resource permissions
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS resource_id uuid;

-- Drop old unique constraint if exists, create new one including resource_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_permissions_user_id_permission_key'
  ) THEN
    ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_user_id_permission_key;
  END IF;
END $$;

-- Use a partial unique index NULL-safe via COALESCE
CREATE UNIQUE INDEX IF NOT EXISTS user_permissions_unique_idx
  ON public.user_permissions (user_id, permission, COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Update has_permission to support resource_id
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission app_permission, _resource_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
      AND (_resource_id IS NULL OR resource_id IS NOT DISTINCT FROM _resource_id)
  ) OR public.has_role(_user_id, 'admin')
$function$;

-- Clean up old per-resource permissions stored without resource_id (they'll be re-granted per resource)
DELETE FROM public.user_permissions
WHERE permission IN (
  'access_vault','edit_vault','delete_vault','create_vault_entry','view_vault_data','view_vault_movements',
  'access_section','edit_section','delete_section','view_section_data','view_section_movements'
)
AND resource_id IS NULL;
