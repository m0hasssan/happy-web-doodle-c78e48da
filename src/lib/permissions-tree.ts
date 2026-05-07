import type { AppPermission } from "@/contexts/permissions-context"

export type PermissionNode = {
  value: AppPermission
  label: string
  children?: PermissionNode[]
}

export const PERMISSION_TREE: PermissionNode[] = [
  {
    value: "view_control_panel",
    label: "لوحة التحكم",
    children: [
      {
        value: "view_current_shift",
        label: "الشيفت الحالي",
        children: [
          { value: "start_shift", label: "بدء شيفت جديد" },
          { value: "end_shift", label: "إنهاء الشيفت" },
        ],
      },
      {
        value: "view_stats",
        label: "الإحصائيات",
        children: [{ value: "export_stats", label: "استخراج الإحصائيات" }],
      },
    ],
  },
  {
    value: "view_vaults",
    label: "الخزن",
    children: [
      { value: "create_vault", label: "إضافة خزنة جديدة" },
      {
        value: "access_vault",
        label: "الدخول للخزنة",
        children: [
          { value: "edit_vault", label: "تعديل الخزنة" },
          { value: "delete_vault", label: "حذف الخزنة" },
          { value: "create_vault_entry", label: "إنشاء قيد دخول" },
          { value: "view_vault_data", label: "عرض بيانات الخزنة" },
          { value: "view_vault_movements", label: "عرض حركات الخزنة" },
        ],
      },
    ],
  },
  {
    value: "view_sections",
    label: "أقسام التصنيع",
    children: [
      { value: "create_section", label: "إضافة قسم جديد" },
      {
        value: "access_section",
        label: "الدخول للقسم",
        children: [
          { value: "edit_section", label: "تعديل القسم" },
          { value: "delete_section", label: "حذف القسم" },
          { value: "view_section_data", label: "عرض بيانات القسم" },
          { value: "view_section_movements", label: "عرض حركات القسم" },
        ],
      },
    ],
  },
  { value: "view_movements", label: "قيود الحركة" },
  {
    value: "view_suppliers",
    label: "الموردين",
    children: [
      { value: "edit_supplier", label: "تعديل المورد" },
      { value: "delete_supplier", label: "حذف المورد" },
      { value: "view_supplier_account", label: "كشف حساب المورد" },
    ],
  },
  {
    value: "view_shifts_history",
    label: "الشيفتات السابقة",
    children: [{ value: "view_shift_details", label: "تفاصيل الشيفت" }],
  },
  {
    value: "view_users",
    label: "المستخدمين والصلاحيات",
    children: [
      { value: "create_users", label: "إضافة مستخدم جديد" },
      { value: "edit_user_profile", label: "تعديل بيانات المستخدم" },
      { value: "edit_user_permissions", label: "تعديل صلاحيات المستخدم" },
      { value: "delete_users", label: "حذف المستخدم" },
    ],
  },
]

type Indexed = {
  node: PermissionNode
  parent: AppPermission | null
  depth: number
}

const INDEX = new Map<AppPermission, Indexed>()
;(function build(nodes: PermissionNode[], parent: AppPermission | null, depth: number) {
  for (const n of nodes) {
    INDEX.set(n.value, { node: n, parent, depth })
    if (n.children?.length) build(n.children, n.value, depth + 1)
  }
})(PERMISSION_TREE, null, 0)

export function getAllPermissionValues(): AppPermission[] {
  return Array.from(INDEX.keys())
}

export function getNode(value: AppPermission): PermissionNode | undefined {
  return INDEX.get(value)?.node
}

export function getDepth(value: AppPermission): number {
  return INDEX.get(value)?.depth ?? 0
}

export function getAncestors(value: AppPermission): AppPermission[] {
  const out: AppPermission[] = []
  let cur = INDEX.get(value)?.parent ?? null
  while (cur) {
    out.push(cur)
    cur = INDEX.get(cur)?.parent ?? null
  }
  return out
}

export function getDescendants(value: AppPermission): AppPermission[] {
  const out: AppPermission[] = []
  const node = INDEX.get(value)?.node
  if (!node?.children) return out
  const walk = (children: PermissionNode[]) => {
    for (const c of children) {
      out.push(c.value)
      if (c.children) walk(c.children)
    }
  }
  walk(node.children)
  return out
}

export function togglePermInTree(
  current: AppPermission[],
  perm: AppPermission,
): AppPermission[] {
  const set = new Set(current)
  if (set.has(perm)) {
    set.delete(perm)
    for (const d of getDescendants(perm)) set.delete(d)
  } else {
    set.add(perm)
    for (const a of getAncestors(perm)) set.add(a)
  }
  return Array.from(set)
}