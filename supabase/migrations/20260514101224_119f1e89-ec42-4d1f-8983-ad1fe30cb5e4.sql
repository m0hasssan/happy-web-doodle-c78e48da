INSERT INTO public.vault_metals (vault_id, metal_id)
SELECT v.id, m.id
FROM public.vaults v
CROSS JOIN public.metals m
LEFT JOIN public.vault_metals vm
  ON vm.vault_id = v.id
 AND vm.metal_id = m.id
WHERE m.kind = 'additional'
  AND vm.metal_id IS NULL;