ALTER TABLE public.metals ADD COLUMN IF NOT EXISTS primary_report_karat text;

UPDATE public.metals SET primary_report_karat = '875' WHERE code = 'gold' AND primary_report_karat IS NULL;