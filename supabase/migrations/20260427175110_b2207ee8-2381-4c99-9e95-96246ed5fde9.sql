ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'view_users';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'manage_users';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'create_users';