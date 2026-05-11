import type { AppPermission } from "@/contexts/permissions-context"

export type PermissionEntry = {
  permission: AppPermission
  resource_id: string | null
}

export type PermNode = {
  key: string
  permission: AppPermission
  resource_id: string | null
  label: string
  children?: PermNode[]
  locked?: boolean
}

export function entryKey(e: {
  permission: AppPermission
  resource_id: string | null
}): string {
  return e.resource_id ? `${e.permission}:${e.resource_id}` : e.permission
}

const n = (
  permission: AppPermission,
  label: string,
  resource_id: string | null = null,
  children?: PermNode[],
  locked = false,
): PermNode => ({
  key: resource_id ? `${permission}:${resource_id}` : permission,
  permission,
  resource_id,
  label,
  children,
  locked,
})

export function buildPermissionTree(
  vaults: { id: string; name: string }[],
  sections: { id: string; name: string }[],
): PermNode[] {
  return [
    n("view_vaults", "الخزن", null, [
      n("create_vault", "إضافة خزنة جديدة"),
      ...vaults.map((v) =>
        n("view_vault", `عرض ${v.name}`, v.id, [
          n("edit_vault", "إعدادات الخزنة (تعديل/تفعيل)", v.id),
          n("delete_vault", "حذف الخزنة", v.id),
          n("access_vault", "الدخول للخزنة", v.id, [
            n("view_vault_data", "عرض بيانات الخزنة", v.id),
            n("view_vault_movements", "عرض حركات الخزنة", v.id),
            n("create_vault_entry", "تسجيل قيود (دخول/خروج/تعديل أعداد)", v.id),
          ]),
        ]),
      ),
    ]),
    n("view_sections", "أقسام التصنيع", null, [
      n("create_section", "إضافة قسم جديد"),
      ...sections.map((s) =>
        n("view_section", `عرض ${s.name}`, s.id, [
          n("edit_section", "إعدادات القسم (تعديل/تفعيل)", s.id),
          n("delete_section", "حذف القسم", s.id),
          n("access_section", "الدخول للقسم", s.id, [
            n("view_section_data", "عرض بيانات القسم", s.id),
            n("view_section_movements", "عرض حركات القسم", s.id),
          ]),
        ]),
      ),
    ]),
    n("view_movements", "قيود الحركة", null, [
      n("edit_movement", "تعديل قيد حركة"),
      n("delete_movement", "حذف قيد حركة"),
    ]),
    n("view_suppliers", "الموردين", null, [
      n("create_supplier", "إضافة مورد جديد"),
      n("edit_supplier", "تعديل المورد"),
      n("delete_supplier", "حذف المورد"),
      n("view_supplier_account", "كشف حساب المورد"),
    ]),
    n("view_work_orders", "أوامر الشغل", null, [
      n("transfer_work_order", "تحويل أمر الشغل (استرداد/إعادة)"),
      n("settle_work_order", "تسوية أمر الشغل"),
      n("delete_work_order", "حذف أمر الشغل"),
    ]),
    n("view_shifts_history", "الشيفتات السابقة", null, [
      n("view_shift_details", "تفاصيل الشيفت"),
      n("start_shift", "بدء شيفت جديد"),
      n("end_shift", "إنهاء الشيفت"),
    ]),
    n("view_recovery", "الخسيات والاسترداد", null, [
      n("manage_recovery", "إدارة عمليات الاسترداد"),
    ]),
    n("view_users", "المستخدمين والصلاحيات", null, [
      n("create_users", "إضافة مستخدم جديد"),
      n("edit_user_profile", "تعديل بيانات المستخدم"),
      n("edit_user_permissions", "تعديل صلاحيات المستخدم"),
      n("delete_users", "حذف المستخدم"),
    ]),
    n("view_system_settings", "إعدادات النظام", null, [
      n("manage_metals", "إدارة المعادن والعيارات"),
      n("manage_categories", "إدارة التصنيفات"),
      n("manage_number_format", "إعدادات الأرقام"),
      n("export_system_data", "تحميل بيانات النظام"),
      n("import_system_data", "رفع بيانات النظام"),
      n("reset_system_movements", "تصفير الحركات"),
      n("delete_system_data", "حذف كل البيانات"),
    ]),
  ]
}

export function flattenTree(tree: PermNode[]): PermNode[] {
  const out: PermNode[] = []
  const walk = (nodes: PermNode[]) => {
    for (const node of nodes) {
      out.push(node)
      if (node.children) walk(node.children)
    }
  }
  walk(tree)
  return out
}

export function buildIndex(
  tree: PermNode[],
): Map<string, { node: PermNode; parent: string | null }> {
  const map = new Map<string, { node: PermNode; parent: string | null }>()
  const walk = (nodes: PermNode[], parent: string | null) => {
    for (const node of nodes) {
      map.set(node.key, { node, parent })
      if (node.children) walk(node.children, node.key)
    }
  }
  walk(tree, null)
  return map
}

export function togglePermInTree(
  tree: PermNode[],
  current: PermissionEntry[],
  target: PermNode,
): PermissionEntry[] {
  const index = buildIndex(tree)
  const set = new Set(current.map(entryKey))
  const targetKey = target.key
  if (set.has(targetKey)) {
    set.delete(targetKey)
    const removeDesc = (node: PermNode) => {
      if (!node.children) return
      for (const c of node.children) {
        set.delete(c.key)
        removeDesc(c)
      }
    }
    removeDesc(target)
  } else {
    set.add(targetKey)
    let cur = index.get(targetKey)?.parent
    while (cur) {
      set.add(cur)
      cur = index.get(cur)?.parent
    }
  }
  const out: PermissionEntry[] = []
  for (const k of set) {
    const node = index.get(k)?.node
    if (node) {
      out.push({ permission: node.permission, resource_id: node.resource_id })
    }
  }
  return out
}

export function getAllEntries(tree: PermNode[]): PermissionEntry[] {
  return flattenTree(tree).map((node) => ({
    permission: node.permission,
    resource_id: node.resource_id,
  }))
}

export function countTree(tree: PermNode[]): number {
  return flattenTree(tree).length
}
