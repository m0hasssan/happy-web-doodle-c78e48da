
-- Drop the 2-arg overload that conflicts with the 3-arg DEFAULT version
DROP FUNCTION IF EXISTS public.has_permission(uuid, app_permission);

-- VAULTS
DROP POLICY IF EXISTS "Admins insert vaults" ON public.vaults;
DROP POLICY IF EXISTS "Admins update vaults" ON public.vaults;
DROP POLICY IF EXISTS "Admins delete vaults" ON public.vaults;

CREATE POLICY "Insert vaults with permission" ON public.vaults
FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'create_vault'::app_permission));

CREATE POLICY "Update vaults with permission" ON public.vaults
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'edit_vault'::app_permission, id));

CREATE POLICY "Delete vaults with permission" ON public.vaults
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'delete_vault'::app_permission, id));

-- VAULT_METALS
DROP POLICY IF EXISTS "Admins insert vault_metals" ON public.vault_metals;
DROP POLICY IF EXISTS "Admins delete vault_metals" ON public.vault_metals;

CREATE POLICY "Insert vault_metals with permission" ON public.vault_metals
FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), 'create_vault'::app_permission)
  OR public.has_permission(auth.uid(), 'edit_vault'::app_permission, vault_id)
);

CREATE POLICY "Delete vault_metals with permission" ON public.vault_metals
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'edit_vault'::app_permission, vault_id));

-- VAULT_INVENTORY
DROP POLICY IF EXISTS "Admins insert vault_inventory" ON public.vault_inventory;
DROP POLICY IF EXISTS "Admins update vault_inventory" ON public.vault_inventory;
DROP POLICY IF EXISTS "Admins delete vault_inventory" ON public.vault_inventory;

CREATE POLICY "Insert vault_inventory with permission" ON public.vault_inventory
FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'create_vault_entry'::app_permission, vault_id));

CREATE POLICY "Update vault_inventory with permission" ON public.vault_inventory
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'create_vault_entry'::app_permission, vault_id));

CREATE POLICY "Delete vault_inventory with permission" ON public.vault_inventory
FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), 'create_vault_entry'::app_permission, vault_id)
  OR public.has_permission(auth.uid(), 'delete_vault'::app_permission, vault_id)
);

-- MANUFACTURING_SECTIONS
DROP POLICY IF EXISTS "Admins insert sections" ON public.manufacturing_sections;
DROP POLICY IF EXISTS "Admins update sections" ON public.manufacturing_sections;
DROP POLICY IF EXISTS "Admins delete sections" ON public.manufacturing_sections;

CREATE POLICY "Insert sections with permission" ON public.manufacturing_sections
FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'create_section'::app_permission));

CREATE POLICY "Update sections with permission" ON public.manufacturing_sections
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'edit_section'::app_permission, id));

CREATE POLICY "Delete sections with permission" ON public.manufacturing_sections
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'delete_section'::app_permission, id));

-- SECTION_METALS
DROP POLICY IF EXISTS "Admins insert section_metals" ON public.section_metals;
DROP POLICY IF EXISTS "Admins delete section_metals" ON public.section_metals;

CREATE POLICY "Insert section_metals with permission" ON public.section_metals
FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), 'create_section'::app_permission)
  OR public.has_permission(auth.uid(), 'edit_section'::app_permission, section_id)
);

CREATE POLICY "Delete section_metals with permission" ON public.section_metals
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'edit_section'::app_permission, section_id));

-- SECTION_INVENTORY
DROP POLICY IF EXISTS "Admins insert section_inventory" ON public.section_inventory;
DROP POLICY IF EXISTS "Admins update section_inventory" ON public.section_inventory;
DROP POLICY IF EXISTS "Admins delete section_inventory" ON public.section_inventory;

CREATE POLICY "Insert section_inventory with permission" ON public.section_inventory
FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'access_section'::app_permission, section_id));

CREATE POLICY "Update section_inventory with permission" ON public.section_inventory
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'access_section'::app_permission, section_id));

CREATE POLICY "Delete section_inventory with permission" ON public.section_inventory
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'access_section'::app_permission, section_id));

-- MOVEMENTS
DROP POLICY IF EXISTS "Admins insert movements" ON public.movements;
DROP POLICY IF EXISTS "Admins update movements" ON public.movements;
DROP POLICY IF EXISTS "Admins delete movements" ON public.movements;

CREATE POLICY "Insert movements with permission" ON public.movements
FOR INSERT TO authenticated
WITH CHECK (
  (from_type = 'vault' AND public.has_permission(auth.uid(), 'create_vault_entry'::app_permission, from_id))
  OR (to_type = 'vault' AND public.has_permission(auth.uid(), 'create_vault_entry'::app_permission, to_id))
  OR (from_type = 'section' AND public.has_permission(auth.uid(), 'access_section'::app_permission, from_id))
  OR (to_type = 'section' AND public.has_permission(auth.uid(), 'access_section'::app_permission, to_id))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Update movements admin only" ON public.movements
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Delete movements admin only" ON public.movements
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- SUPPLIERS
DROP POLICY IF EXISTS "Admins insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins delete suppliers" ON public.suppliers;

CREATE POLICY "Insert suppliers authenticated" ON public.suppliers
FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'view_suppliers'::app_permission));

CREATE POLICY "Update suppliers with permission" ON public.suppliers
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'edit_supplier'::app_permission));

CREATE POLICY "Delete suppliers with permission" ON public.suppliers
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'delete_supplier'::app_permission));

-- SHIFTS
DROP POLICY IF EXISTS "Admins insert shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admins update shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admins delete shifts" ON public.shifts;

CREATE POLICY "Insert shifts with permission" ON public.shifts
FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'start_shift'::app_permission));

CREATE POLICY "Update shifts with permission" ON public.shifts
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'end_shift'::app_permission));

CREATE POLICY "Delete shifts admin only" ON public.shifts
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
