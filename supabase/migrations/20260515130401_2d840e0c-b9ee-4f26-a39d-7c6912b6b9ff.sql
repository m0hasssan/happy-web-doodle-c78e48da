CREATE OR REPLACE FUNCTION public.set_category_requires_count(_category_id uuid, _value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE='42501';
  END IF;

  ALTER TABLE public.metal_categories DISABLE TRIGGER trg_validate_metal_category;

  WITH RECURSIVE subtree AS (
    SELECT id FROM public.metal_categories WHERE id = _category_id
    UNION ALL
    SELECT c.id FROM public.metal_categories c
    JOIN subtree s ON c.parent_id = s.id
  )
  UPDATE public.metal_categories
  SET requires_count = _value
  WHERE id IN (SELECT id FROM subtree);

  ALTER TABLE public.metal_categories ENABLE TRIGGER trg_validate_metal_category;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_category_requires_count(uuid, boolean) TO authenticated;