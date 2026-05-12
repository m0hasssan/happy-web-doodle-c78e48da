-- Shorten system codes to 2-letter prefix + 5 digits using sequences

CREATE SEQUENCE IF NOT EXISTS public.movements_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.shifts_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.work_orders_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.recovery_operations_code_seq START 1;

ALTER TABLE public.movements
  ALTER COLUMN code SET DEFAULT ('MV-' || lpad(nextval('public.movements_code_seq')::text, 5, '0'));

ALTER TABLE public.shifts
  ALTER COLUMN code SET DEFAULT ('SH-' || lpad(nextval('public.shifts_code_seq')::text, 5, '0'));

ALTER TABLE public.work_orders
  ALTER COLUMN code SET DEFAULT ('WO-' || lpad(nextval('public.work_orders_code_seq')::text, 5, '0'));

ALTER TABLE public.recovery_operations
  ALTER COLUMN code SET DEFAULT ('RC-' || lpad(nextval('public.recovery_operations_code_seq')::text, 5, '0'));

-- Suppliers already uses a sequence; bump padding to 5 digits
ALTER TABLE public.suppliers
  ALTER COLUMN code SET DEFAULT ('SP-' || lpad(nextval('public.suppliers_code_seq')::text, 5, '0'));
