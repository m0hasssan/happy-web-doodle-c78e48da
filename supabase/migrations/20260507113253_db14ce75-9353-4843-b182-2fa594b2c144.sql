-- Extend app_permission enum with full hierarchical permission set.
-- Keeping legacy values for backwards compatibility with existing rows.
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_control_panel';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_current_shift';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'start_shift';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'end_shift';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_stats';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'export_stats';

ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_vaults';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'create_vault';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'access_vault';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'edit_vault';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'delete_vault';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'create_vault_entry';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_vault_data';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_vault_movements';

ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_sections';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'create_section';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'access_section';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'edit_section';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'delete_section';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_section_data';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_section_movements';

ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_movements';

ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_suppliers';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'edit_supplier';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'delete_supplier';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_supplier_account';

ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_shifts_history';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_shift_details';

ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'edit_user_profile';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'edit_user_permissions';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'delete_users';