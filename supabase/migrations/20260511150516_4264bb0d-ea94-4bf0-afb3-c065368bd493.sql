
-- New permissions
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'view_recovery';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'manage_recovery';
