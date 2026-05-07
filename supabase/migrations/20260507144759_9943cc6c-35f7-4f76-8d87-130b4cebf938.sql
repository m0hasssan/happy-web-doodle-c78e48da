
-- Set search_path on guard functions
ALTER FUNCTION public.guard_vault_delete() SET search_path = public;
ALTER FUNCTION public.guard_section_delete() SET search_path = public;

-- Revoke public execute on trigger-only functions
REVOKE ALL ON FUNCTION public.movements_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_movement_inventory() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_movement_inventory() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_vault_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_section_delete() FROM PUBLIC, anon, authenticated;
