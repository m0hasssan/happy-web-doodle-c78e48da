-- Work orders
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_work_orders';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'transfer_work_order';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'settle_work_order';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'delete_work_order';

-- Suppliers
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'create_supplier';

-- System settings
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_system_settings';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'manage_metals';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'manage_categories';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'manage_number_format';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'export_system_data';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'import_system_data';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'reset_system_movements';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'delete_system_data';