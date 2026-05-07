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
): PermNode => ({
  key: resource_id ? `${permission}:${resource_id}` : permission,
  permission,
  resource_id,
  label,
  children,
})

export function buildPermissionTree(
  vaults: { id: string; name: string }[],
  sections: { id: string; name: string }[],
): PermNode[] {
  return [
    n("view_control_panel", "لوحة التحكم", null, [
      n("view_current_shift", "الشيفت الحالي", null, [
        n("start_shift", "بدء شيفت جديد"),
        n("end_shift", "إنهاء الشيفت"),
      ]),
      n("view_stats", "الإحصائيات", null, [
        n("export_stats", "استخراج الإحصائيات"),
      ]),
    ]),
    n("view_vaults", "الخزن", null, [
      n("create_vault", "إضافة خزنة جديدة"),
      ...vaults.map((v) =>
        n("access_vault", `الدخول لـ ${v.name}`, v.id, [
          n("edit_vault", "تعديل الخزنة", v.id),
          n("delete_vault", "حذف الخزنة", v.id),
          n("create_vault_entry", "إنشاء قيد دخول", v.id),
          n("view_vault_data", "عرض بيانات الخزنة", v.id),
          n("view_vault_movements", "عرض حركات الخزنة", v.id),
        ]),
      ),
    ]),
    n("view_sections", "أقسام التصنيع", null, [
      n("create_section", "إضافة قسم جديد"),
      ...sections.map((s) =>
        n("access_section", `الدخول لـ ${s.name}`, s.id, [
          n("edit_section", "تعديل القسم", s.id),
          n("delete_section", "حذف القسم", s.id),
          n("view_section_data", "عرض بيانات القسم", s.id),
          n("view_section_movements", "عرض حركات القسم", s.id),
        ]),
      ),
    ]),
    n("view_movements", "قيود الحركة"),
    n("view_suppliers", "الموردين", null, [
      n("edit_supplier", "تعديل المورد"),
      n("delete_supplier", "حذف المورد"),
      n("view_supplier_account", "كشف حساب المورد"),
    ]),
    n("view_shifts_history", "الشيفتات السابقة", null, [
      n("view_shift_details", "تفاصيل الشيفت"),
    ]),
    n("view_users", "المستخدمين والصلاحيات", null, [
      n("create_users", "إضافة مستخدم جديد"),
      n("edit_user_profile", "تعديل بيانات المستخدم"),
      n("edit_user_permissions", "تعديل صلاحيات المستخدم"),
      n("delete_users", "حذف المستخدم"),
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
