
ALTER TABLE public.vaults
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.vault_inventory
  ADD COLUMN IF NOT EXISTS karat text;

-- Drop the old unique-by-(vault,metal) implication if any inventory upserts depended on it.
-- We'll allow multiple rows per (vault, metal) when split by karat.
