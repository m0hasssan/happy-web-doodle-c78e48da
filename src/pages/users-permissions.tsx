import * as React from "react"
import { MoreHorizontal, Pencil, Trash2, Plus, Shield, ShieldCheck, UserCog } from "lucide-react"
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
import { PermissionTree } from "@/components/permission-tree"
import {
  buildPermissionTree,
  getAllEntries,
  countTree,
  type PermissionEntry,
} from "@/lib/permissions-tree"

interface UserRow {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  permissions: PermissionEntry[]
}

export function UsersPermissionsPage() {
  const { isAdmin, hasPermission, loading: permLoading, refresh: refreshPerms } = usePermissions()
  const canEditPerms = isAdmin || hasPermission("edit_user_permissions")
  const canEditProfile = isAdmin || hasPermission("edit_user_profile")
  const canDelete = isAdmin || hasPermission("delete_users")
  const canCreate = isAdmin || hasPermission("create_users")
  const canManage = canEditPerms || canEditProfile || canDelete
  const [users, setUsers] = React.useState<UserRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<UserRow | null>(null)
  const [deleting, setDeleting] = React.useState<UserRow | null>(null)
  const [editingProfile, setEditingProfile] = React.useState<UserRow | null>(null)
  const [profileUsername, setProfileUsername] = React.useState("")
  const [profileFullName, setProfileFullName] = React.useState("")
  const [savingProfile, setSavingProfile] = React.useState(false)
  const [draftPerms, setDraftPerms] = React.useState<PermissionEntry[]>([])
  const [draftAdmin, setDraftAdmin] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Create user dialog state
  const [createOpen, setCreateOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [newUsername, setNewUsername] = React.useState("")
  const [newFullName, setNewFullName] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [newIsAdmin, setNewIsAdmin] = React.useState(false)
  const [newPerms, setNewPerms] = React.useState<PermissionEntry[]>([])

  const [vaultList, setVaultList] = React.useState<{ id: string; name: string }[]>([])
  const [sectionList, setSectionList] = React.useState<{ id: string; name: string }[]>([])

  const totalPerms = React.useMemo(
    () => countTree(buildPermissionTree(vaultList, sectionList)),
    [vaultList, sectionList],
  )
  const allEntries = React.useMemo(
    () => getAllEntries(buildPermissionTree(vaultList, sectionList)),
    [vaultList, sectionList],
  )

  const resetCreateForm = () => {
    setNewUsername("")
    setNewFullName("")
    setNewPassword("")
    setNewIsAdmin(false)
    setNewPerms([])
  }

  const handleCreate = async () => {
    const uname = newUsername.trim().toLowerCase()
    if (!uname || !newPassword) {
      toast.error("الرجاء إدخال اسم المستخدم وكلمة المرور")
      return
    }
    if (!/^[a-z0-9_.-]{2,30}$/.test(uname)) {
      toast.error("اسم المستخدم يجب أن يكون أحرف إنجليزية أو أرقام (2-30)")
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
            username: uname,
            password: newPassword,
            full_name: newFullName.trim() || uname,
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
    const [profilesRes, rolesRes, permsRes, vaultsRes, sectionsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_permissions").select("user_id, permission, resource_id"),
      supabase.from("vaults").select("id, name").order("created_at"),
      supabase.from("manufacturing_sections").select("id, name").order("created_at"),
    ])

    if (profilesRes.error) {
      toast.error("فشل تحميل المستخدمين")
      setLoading(false)
      return
    }

    const adminSet = new Set(
      (rolesRes.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    )
    const permsByUser = new Map<string, PermissionEntry[]>()
    for (const row of (permsRes.data ?? []) as Array<{
      user_id: string
      permission: string
      resource_id: string | null
    }>) {
      const arr = permsByUser.get(row.user_id) ?? []
      arr.push({
        permission: row.permission as AppPermission,
        resource_id: row.resource_id ?? null,
      })
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
    setVaultList((vaultsRes.data ?? []) as { id: string; name: string }[])
    setSectionList((sectionsRes.data ?? []) as { id: string; name: string }[])
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

  const openEditProfile = (row: UserRow) => {
    setEditingProfile(row)
    setProfileUsername(row.email.replace(/@users\.local$/, ""))
    setProfileFullName(row.full_name ?? "")
  }

  const handleSaveProfile = async () => {
    if (!editingProfile) return
    const uname = profileUsername.trim().toLowerCase()
    if (!/^[a-z0-9_.-]{2,30}$/.test(uname)) {
      toast.error("اسم المستخدم يجب أن يكون أحرف إنجليزية أو أرقام (2-30)")
      return
    }
    setSavingProfile(true)
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-update-user",
        {
          body: {
            user_id: editingProfile.id,
            username: uname,
            full_name: profileFullName.trim() || uname,
          },
        },
      )
      if (error) throw error
      const payload = data as { error?: string; success?: boolean }
      if (payload?.error) throw new Error(payload.error)
      toast.success("تم حفظ التغييرات")
      setEditingProfile(null)
      await loadUsers()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "فشل التعديل"
      toast.error(msg)
    } finally {
      setSavingProfile(false)
    }
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

      // Sync permissions: replace all (handles per-resource entries cleanly)
      const { error: delErr } = await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", editing.id)
      if (delErr) throw delErr
      if (draftPerms.length) {
        const { error } = await supabase.from("user_permissions").insert(
          draftPerms.map((p) => ({
            user_id: editing.id,
            permission: p.permission,
            resource_id: p.resource_id,
          })),
        )
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
          {row.is_admin ? TOTAL_PERMS : row.permissions.length}/{TOTAL_PERMS}
        </Badge>
      ),
    },
    {
      key: "email",
      header: "اسم المستخدم",
      sortable: true,
      cell: (row) => (
        <span className="text-muted-foreground" dir="ltr">
          {row.email.replace(/@users\.local$/, "")}
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
            <DropdownMenuItem onSelect={() => openEditProfile(row)} disabled={!canEditProfile}>
              <UserCog />
              <span>تعديل البيانات</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openEdit(row)} disabled={!canEditPerms}>
              <Pencil />
              <span>تعديل الصلاحيات</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleting(row)}
              disabled={!canDelete}
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
              <PermissionTree
                value={draftAdmin ? getAllPermissionValues() : draftPerms}
                onChange={setDraftPerms}
                disabled={draftAdmin}
              />
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
              <Label htmlFor="new-username">اسم المستخدم</Label>
              <Input
                id="new-username"
                type="text"
                dir="ltr"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="username"
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
              <PermissionTree
                value={newIsAdmin ? getAllPermissionValues() : newPerms}
                onChange={setNewPerms}
                disabled={newIsAdmin}
              />
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

      {/* Edit profile dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(o) => !o && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل البيانات</DialogTitle>
            <DialogDescription>
              تعديل اسم المستخدم واسم العرض
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-fullname">الاسم الكامل</Label>
              <Input
                id="edit-fullname"
                value={profileFullName}
                onChange={(e) => setProfileFullName(e.target.value)}
                placeholder="مثال: محمد أحمد"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">اسم المستخدم</Label>
              <Input
                id="edit-username"
                dir="ltr"
                value={profileUsername}
                onChange={(e) => setProfileUsername(e.target.value)}
                placeholder="username"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>
              إلغاء
            </Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default UsersPermissionsPage
