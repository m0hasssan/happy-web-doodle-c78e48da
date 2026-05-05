import * as React from "react"
import { MoreHorizontal, Pencil, Trash2, Plus, Shield, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { toast } from "sonner"
import { supabase } from "@/integrations/supabase/client"
import { usePermissions, type AppPermission } from "@/hooks/use-permissions"

interface UserRow {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  permissions: AppPermission[]
}

type PermDef = {
  value: AppPermission
  label: string
  /** صلاحية يجب تفعيلها قبل تفعيل هذه (مستوى أعلى) */
  requires?: AppPermission
}

type PermGroup = {
  label: string
  perms: PermDef[]
}

const PERMISSION_GROUPS: PermGroup[] = [
  {
    label: "لوحة التحكم",
    perms: [
      { value: "view_dashboard", label: "عرض لوحة التحكم" },
      { value: "export_data", label: "استخراج البيانات", requires: "view_dashboard" },
    ],
  },
  {
    label: "المستخدمين والصلاحيات",
    perms: [
      { value: "view_users", label: "عرض المستخدمين والصلاحيات" },
      { value: "create_users", label: "إضافة مستخدم جديد", requires: "view_users" },
      { value: "manage_users", label: "تعديل وحذف المستخدمين", requires: "view_users" },
    ],
  },
]

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.perms)
const PERM_MAP = new Map(ALL_PERMISSIONS.map((p) => [p.value, p]))

/** يرجّع صلاحية مع كل ما تتطلبه من صلاحيات أعلى */
function withRequired(perm: AppPermission): AppPermission[] {
  const out: AppPermission[] = [perm]
  let cur = PERM_MAP.get(perm)?.requires
  while (cur) {
    out.push(cur)
    cur = PERM_MAP.get(cur)?.requires
  }
  return out
}

/** يرجّع كل الصلاحيات اللي تعتمد على صلاحية معينة (مباشرة أو بسلسلة) */
function dependentsOf(perm: AppPermission): AppPermission[] {
  const direct = ALL_PERMISSIONS.filter((p) => p.requires === perm).map((p) => p.value)
  return direct.flatMap((d) => [d, ...dependentsOf(d)])
}

/** Toggle صلاحية مع احترام التبعيات (إضافة الأب أو إزالة الأبناء) */
function togglePermSafe(
  current: AppPermission[],
  perm: AppPermission,
): AppPermission[] {
  const has = current.includes(perm)
  if (has) {
    // إزالة الصلاحية + كل ما يعتمد عليها
    const toRemove = new Set([perm, ...dependentsOf(perm)])
    return current.filter((p) => !toRemove.has(p))
  }
  // إضافة الصلاحية + كل ما تتطلبه
  const toAdd = withRequired(perm)
  const set = new Set(current)
  toAdd.forEach((p) => set.add(p))
  return Array.from(set)
}


export function UsersPermissionsPage() {
  const { isAdmin, hasPermission, loading: permLoading, refresh: refreshPerms } = usePermissions()
  const canManage = isAdmin || hasPermission("manage_users")
  const canCreate = isAdmin || hasPermission("create_users")
  const [users, setUsers] = React.useState<UserRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<UserRow | null>(null)
  const [deleting, setDeleting] = React.useState<UserRow | null>(null)
  const [draftPerms, setDraftPerms] = React.useState<AppPermission[]>([])
  const [draftAdmin, setDraftAdmin] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Create user dialog state
  const [createOpen, setCreateOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [newEmail, setNewEmail] = React.useState("")
  const [newFullName, setNewFullName] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [newIsAdmin, setNewIsAdmin] = React.useState(false)
  const [newPerms, setNewPerms] = React.useState<AppPermission[]>([])

  const resetCreateForm = () => {
    setNewEmail("")
    setNewFullName("")
    setNewPassword("")
    setNewIsAdmin(false)
    setNewPerms([])
  }

  const toggleNewPerm = (p: AppPermission) => {
    setNewPerms((prev) => togglePermSafe(prev, p))
  }

  const handleCreate = async () => {
    if (!newEmail.trim() || !newPassword) {
      toast.error("الرجاء إدخال البريد وكلمة المرور")
      return
    }
    if (newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف فأكثر")
      return
    }
    setCreating(true)
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-create-user",
        {
          body: {
            email: newEmail.trim(),
            password: newPassword,
            full_name: newFullName.trim() || undefined,
            is_admin: newIsAdmin,
            permissions: newIsAdmin ? [] : newPerms,
          },
        },
      )
      if (error) throw error
      const payload = data as { error?: string; success?: boolean }
      if (payload?.error) throw new Error(payload.error)
      toast.success("تم إنشاء المستخدم بنجاح")
      setCreateOpen(false)
      resetCreateForm()
      await loadUsers()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "فشل إنشاء المستخدم"
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }


  const loadUsers = React.useCallback(async () => {
    setLoading(true)
    const [profilesRes, rolesRes, permsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_permissions").select("user_id, permission"),
    ])

    if (profilesRes.error) {
      toast.error("فشل تحميل المستخدمين")
      setLoading(false)
      return
    }

    const adminSet = new Set(
      (rolesRes.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    )
    const permsByUser = new Map<string, AppPermission[]>()
    for (const row of permsRes.data ?? []) {
      const arr = permsByUser.get(row.user_id) ?? []
      arr.push(row.permission as AppPermission)
      permsByUser.set(row.user_id, arr)
    }

    const rows: UserRow[] = (profilesRes.data ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      is_admin: adminSet.has(p.id),
      permissions: permsByUser.get(p.id) ?? [],
    }))

    setUsers(rows)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const openEdit = (row: UserRow) => {
    setEditing(row)
    setDraftAdmin(row.is_admin)
    setDraftPerms(row.permissions)
  }

  const togglePerm = (p: AppPermission) => {
    setDraftPerms((prev) => togglePermSafe(prev, p))
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      // Sync admin role
      if (draftAdmin && !editing.is_admin) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: editing.id, role: "admin" })
        if (error) throw error
      } else if (!draftAdmin && editing.is_admin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", editing.id)
          .eq("role", "admin")
        if (error) throw error
      }

      // Sync permissions
      const toAdd = draftPerms.filter((p) => !editing.permissions.includes(p))
      const toRemove = editing.permissions.filter((p) => !draftPerms.includes(p))

      if (toAdd.length) {
        const { error } = await supabase
          .from("user_permissions")
          .insert(toAdd.map((p) => ({ user_id: editing.id, permission: p })))
        if (error) throw error
      }
      if (toRemove.length) {
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", editing.id)
          .in("permission", toRemove)
        if (error) throw error
      }

      toast.success("تم حفظ التغييرات")
      setEditing(null)
      await loadUsers()
      await refreshPerms()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "حدث خطأ"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    const { data, error } = await supabase.functions.invoke(
      "admin-delete-user",
      { body: { user_id: deleting.id } },
    )
    const payload = data as { error?: string; success?: boolean } | null
    if (error || payload?.error) {
      toast.error(payload?.error ?? "تعذر حذف المستخدم")
      return
    }
    toast.success(`تم حذف: ${deleting.full_name ?? deleting.email}`)
    setDeleting(null)
    await loadUsers()
  }

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "name",
      header: "اسم المستخدم",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.full_name ?? "—"}</span>
          {row.is_admin && (
            <Badge variant="default" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              مسؤول
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "permissions",
      header: "عدد الصلاحيات",
      sortable: false,
      cell: (row) => (
        <Badge variant="secondary" className="font-mono">
          {row.is_admin ? ALL_PERMISSIONS.length : row.permissions.length}/{ALL_PERMISSIONS.length}
        </Badge>
      ),
    },
    {
      key: "email",
      header: "البريد الإلكتروني",
      sortable: true,
      cell: (row) => (
        <span className="text-muted-foreground" dir="ltr">
          {row.email}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">إجراءات</span>,
      headerClassName: "w-12",
      className: "w-12",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">القائمة</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onSelect={() => openEdit(row)} disabled={!canManage}>
              <Pencil />
              <span>تعديل الصلاحيات</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleting(row)}
              disabled={!canManage}
            >
              <Trash2 />
              <span>حذف</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمين والصلاحيات"
        description="إدارة جميع مستخدمي النظام وصلاحياتهم"
        actions={
          <Button disabled={!canCreate} onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>إضافة مستخدم</span>
          </Button>
        }
      />

      {!permLoading && !canManage && (
        <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
          أنت تعرض البيانات بصلاحيات محدودة. التعديل والحذف يتطلب صلاحية «تعديل وحذف المستخدمين».
        </div>
      )}

      <DataTable
        data={users}
        columns={columns}
        rowKey={(r) => r.id}
        searchKeys={["full_name", "email"]}
        searchPlaceholder="ابحث بالاسم أو البريد الإلكتروني ..."
        pageSize={20}
        onRefresh={() => {
          loadUsers()
          toast.success("تم تحديث البيانات")
        }}
        emptyMessage={loading ? "جارٍ التحميل..." : "لا توجد بيانات"}
      />

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل الصلاحيات</DialogTitle>
            <DialogDescription>
              {editing?.full_name ?? editing?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="scrollbar-thin -me-2 min-w-0 flex-1 space-y-4 overflow-y-auto pe-2 py-1">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <div>
                  <Label htmlFor="admin-toggle" className="cursor-pointer">
                    صلاحيات المسؤول
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    وصول كامل لكل الصلاحيات
                  </p>
                </div>
              </div>
              <Checkbox
                id="admin-toggle"
                checked={draftAdmin}
                onCheckedChange={(v) => setDraftAdmin(!!v)}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">الصلاحيات الفردية</Label>
              <div className="space-y-3 rounded-md border p-3">
                {PERMISSION_GROUPS.map((group, gi) => (
                  <div key={group.label} className="space-y-2">
                    {gi > 0 && <div className="border-t" />}
                    <p className="text-xs font-semibold text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="space-y-2">
                      {group.perms.map((p) => {
                        const parentMissing =
                          !!p.requires && !draftPerms.includes(p.requires)
                        const lockedByParent = !draftAdmin && parentMissing
                        const parentLabel = p.requires
                          ? PERM_MAP.get(p.requires)?.label
                          : null
                        return (
                          <div key={p.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`perm-${p.value}`}
                              checked={draftAdmin || draftPerms.includes(p.value)}
                              disabled={draftAdmin || lockedByParent}
                              onCheckedChange={() => togglePerm(p.value)}
                            />
                            <Label
                              htmlFor={`perm-${p.value}`}
                              className="cursor-pointer text-sm font-normal"
                            >
                              {p.label}
                              {parentLabel && (
                                <span className="ms-2 text-xs text-muted-foreground">
                                  (تتطلب: {parentLabel})
                                </span>
                              )}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف بيانات «{deleting?.full_name ?? deleting?.email}» نهائياً ولا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create user dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o) resetCreateForm()
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة مستخدم جديد</DialogTitle>
            <DialogDescription>
              أدخل بيانات المستخدم وحدد صلاحياته
            </DialogDescription>
          </DialogHeader>

          <div className="scrollbar-thin -me-2 min-w-0 flex-1 space-y-4 overflow-y-auto pe-2 py-1">
            <div className="space-y-2">
              <Label htmlFor="new-fullname">الاسم الكامل</Label>
              <Input
                id="new-fullname"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="مثال: محمد أحمد"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">البريد الإلكتروني</Label>
              <Input
                id="new-email"
                type="email"
                dir="ltr"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور</Label>
              <Input
                id="new-password"
                type="text"
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6 أحرف على الأقل"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <div>
                  <Label htmlFor="new-admin" className="cursor-pointer">
                    صلاحيات المسؤول
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    وصول كامل لكل الصلاحيات
                  </p>
                </div>
              </div>
              <Checkbox
                id="new-admin"
                checked={newIsAdmin}
                onCheckedChange={(v) => setNewIsAdmin(!!v)}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">الصلاحيات الفردية</Label>
              <div className="space-y-3 rounded-md border p-3">
                {PERMISSION_GROUPS.map((group, gi) => (
                  <div key={group.label} className="space-y-2">
                    {gi > 0 && <div className="border-t" />}
                    <p className="text-xs font-semibold text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="space-y-2">
                      {group.perms.map((p) => {
                        const parentMissing =
                          !!p.requires && !newPerms.includes(p.requires)
                        const lockedByParent = !newIsAdmin && parentMissing
                        const parentLabel = p.requires
                          ? PERM_MAP.get(p.requires)?.label
                          : null
                        return (
                          <div key={p.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`new-perm-${p.value}`}
                              checked={newIsAdmin || newPerms.includes(p.value)}
                              disabled={newIsAdmin || lockedByParent}
                              onCheckedChange={() => toggleNewPerm(p.value)}
                            />
                            <Label
                              htmlFor={`new-perm-${p.value}`}
                              className="cursor-pointer text-sm font-normal"
                            >
                              {p.label}
                              {parentLabel && (
                                <span className="ms-2 text-xs text-muted-foreground">
                                  (تتطلب: {parentLabel})
                                </span>
                              )}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "جارٍ الإنشاء..." : "إنشاء المستخدم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default UsersPermissionsPage
