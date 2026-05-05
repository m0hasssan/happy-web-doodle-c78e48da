
ALTER TABLE public.vault_inventory DROP CONSTRAINT IF EXISTS vault_inventory_vault_id_metal_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS vault_inventory_vault_metal_karat_uq
  ON public.vault_inventory (vault_id, metal_id, COALESCE(karat,''));
