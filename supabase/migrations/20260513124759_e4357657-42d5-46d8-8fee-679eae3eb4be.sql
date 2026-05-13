-- Force all weight/numeric columns to 2 decimal places
ALTER TABLE public.movements ALTER COLUMN weight TYPE numeric(14,2) USING round(weight, 2);
ALTER TABLE public.vault_inventory ALTER COLUMN total_weight TYPE numeric(14,2) USING round(total_weight, 2);
ALTER TABLE public.section_inventory ALTER COLUMN total_weight TYPE numeric(14,2) USING round(total_weight, 2);
ALTER TABLE public.section_shrinkage_inventory ALTER COLUMN total_weight TYPE numeric(14,2) USING round(total_weight, 2);
ALTER TABLE public.recovery_entries ALTER COLUMN weight_999 TYPE numeric(14,2) USING round(weight_999, 2);
ALTER TABLE public.recovery_operation_sections ALTER COLUMN recovered_999 TYPE numeric(14,2) USING round(recovered_999, 2);
ALTER TABLE public.recovery_operation_sections ALTER COLUMN initial_loss_999 TYPE numeric(14,2) USING round(initial_loss_999, 2);
ALTER TABLE public.recovery_operation_sections ALTER COLUMN waste_999 TYPE numeric(14,2) USING round(waste_999, 2);
ALTER TABLE public.work_order_shrinkage ALTER COLUMN pure_999_weight TYPE numeric(14,2) USING round(pure_999_weight, 2);
ALTER TABLE public.work_order_shrinkage ALTER COLUMN missing_weight TYPE numeric(14,2) USING round(missing_weight, 2);
ALTER TABLE public.gold_prices ALTER COLUMN buy TYPE numeric(14,2) USING round(buy, 2);
ALTER TABLE public.gold_prices ALTER COLUMN sell TYPE numeric(14,2) USING round(sell, 2);