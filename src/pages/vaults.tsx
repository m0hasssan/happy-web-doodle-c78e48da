import { useEffect, useState } from "react"
import { MoreVertical, Plus, Trash2, Pencil, Vault as VaultIcon, Power, ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CardGridSkeleton } from "@/components/loading-skeletons"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { metalClasses } from "@/lib/metal-colors"
import { usePermissions } from "@/hooks/use-permissions"
import { Lock } from "lucide-react"
import { formatWeight } from "@/lib/number-format"

type Metal = { id: string; code: string; name_ar: string; enabled: boolean; color: string }
type Vault = { id: string; name: string; status: string }
type VaultMetal = { vault_id: string; metal_id: string }
type Inventory = { vault_id: string; metal_id: string; total_weight: number }

export function VaultsPage() {
  const { hasPermission, loading: permLoading } = usePermissions()
  const canView = hasPermission("view_vaults")
  const canCreate = hasPermission("create_vault")
  const [metals, setMetals] = useState<Metal[]>([])
  const [vaults, setVaults] = useState<Vault[]>([])
  const [vaultMetals, setVaultMetals] = useState<VaultMetal[]>([])
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [loading, setLoading] = useState(true)

  // dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Vault | null>(null)
  const [deleting, setDeleting] = useState<Vault | null>(null)
  const [hasWeightAlert, setHasWeightAlert] = useState<Vault | null>(null)

  const loadAll = async () => {
    setLoading(true)
    const [m, v, vm, inv] = await Promise.all([
      supabase.from("metals").select("id,code,name_ar,enabled,color").eq("enabled", true).order("name_ar"),
      supabase.from("vaults").select("id,name,status").order("created_at"),
      supabase.from("vault_metals").select("*"),
      supabase.from("vault_inventory").select("vault_id, metal_id, total_weight"),
    ])
    setMetals((m.data ?? []) as Metal[])
    setVaults((v.data ?? []) as Vault[])
    setVaultMetals((vm.data ?? []) as VaultMetal[])
    setInventory((inv.data ?? []) as Inventory[])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const totalsForVault = (vaultId: string) => {
    const vMetalIds = vaultMetals.filter((x) => x.vault_id === vaultId).map((x) => x.metal_id)
    return metals
      .filter((m) => vMetalIds.includes(m.id))
      .map((m) => {
        const w = inventory
          .filter((i) => i.vault_id === vaultId && i.metal_id === m.id)
          .reduce((s, i) => s + Number(i.total_weight), 0)
        return { metal: m, weight: w }
      })
  }

  const vaultHasWeight = (vaultId: string) =>
    inventory.some((i) => i.vault_id === vaultId && Number(i.total_weight) > 0)

  const handleDeleteRequest = (v: Vault) => {
    if (vaultHasWeight(v.id)) {
      setHasWeightAlert(v)
    } else {
      setDeleting(v)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const { error } = await supabase.from("vaults").delete().eq("id", deleting.id)
    if (error) {
      toast.error("فشل حذف الخزنة")
    } else {
      toast.success("تم حذف الخزنة")
      setDeleting(null)
      loadAll()
    }
  }

  const toggleStatus = async (v: Vault) => {
    const next = v.status === "active" ? "disabled" : "active"
    const { error } = await supabase.from("vaults").update({ status: next }).eq("id", v.id)
    if (error) return toast.error("فشل تغيير حالة الخزنة")
    toast.success(next === "active" ? "تم تنشيط الخزنة" : "تم تعطيل الخزنة")
    loadAll()
  }

  return (
    !permLoading && !canView ? (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">لا تملك الصلاحية</h2>
            <p className="text-sm text-muted-foreground">ليس لديك صلاحية «عرض الخزن».</p>
          </CardContent>
        </Card>
      </div>
    ) : (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الخزن"
        description="إدارة خزن المعادن في النظام"
        actions={
          canCreate ? (
            <Button className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              إضافة خزنة جديدة
            </Button>
          ) : null
        }
      />

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : vaults.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <VaultIcon className="h-10 w-10" />
            <p>لا توجد خزن بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vaults.map((v) => {
            const totals = totalsForVault(v.id)
            const empty = totals.every((t) => t.weight === 0)
            const canAccess = hasPermission("access_vault", v.id)
            const canEdit = hasPermission("edit_vault", v.id)
            const canDelete = hasPermission("delete_vault", v.id)
            return (
              <Card key={v.id} className="relative">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                      <VaultIcon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{v.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={v.status === "active" ? "default" : "secondary"}>
                      {v.status === "active" ? "نشطة" : "معطلة"}
                    </Badge>
                    {(canEdit || canDelete) && (
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(v)} disabled={!canEdit}>
                        <Pencil className="h-4 w-4" />
                        تعديل
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStatus(v)} disabled={!canEdit}>
                        <Power className="h-4 w-4" />
                        {v.status === "active" ? "تعطيل الخزنة" : "تنشيط الخزنة"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleDeleteRequest(v)}
                        disabled={!canDelete}
                      >
                        <Trash2 className="h-4 w-4" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 pt-0">
                  {empty ? (
                    <div className="flex flex-1 items-center justify-center rounded-md bg-muted/50 px-3 py-8 text-center text-sm text-muted-foreground min-h-[120px]">
                      الخزنة فارغة
                    </div>
                  ) : (
                    <ul className="flex flex-1 flex-col gap-2">
                      {totals.map((t) => {
                        const c = metalClasses(t.metal.color)
                        return (
                          <li
                            key={t.metal.id}
                            className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${c.bg} ${c.border}`}
                          >
                            <span className={c.text}>{t.metal.name_ar}</span>
                            <span className={`font-semibold tabular-nums ${c.text}`}>
                              {formatWeight(t.weight)} جم
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {canAccess && (
                  <Button asChild variant="outline" className="mt-auto w-full gap-2">
                    <Link to={`/vaults/${v.id}`}>
                      <span>الدخول للخزنة</span>
                      <ArrowLeft className="h-4 w-4 ms-auto" />
                    </Link>
                  </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AddVaultDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        metals={metals}
        onCreated={loadAll}
      />

      <EditVaultDialog
        vault={editing}
        metals={metals}
        vaultMetals={vaultMetals}
        inventory={inventory}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={loadAll}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من رغبتك في حذف الخزنة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الخزنة «{deleting?.name}» نهائياً ولا يمكن التراجع عن هذه العملية.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hasWeightAlert} onOpenChange={(o) => !o && setHasWeightAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>لا يمكن حذف الخزنة</AlertDialogTitle>
            <AlertDialogDescription>
              الخزنة «{hasWeightAlert?.name}» تحتوي على وزن من المعادن. يجب تفريغها أولاً قبل حذفها.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setHasWeightAlert(null)}>حسناً</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    )
  )
}

function AddVaultDialog({
  open,
  onOpenChange,
  metals,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  metals: Metal[]
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setSelected(metals.map((m) => m.id))
    }
  }, [open, metals])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const submit = async () => {
    if (!name.trim()) return toast.error("ادخل اسم الخزنة")
    if (selected.length === 0) return toast.error("اختر معدناً واحداً على الأقل")
    setSaving(true)
    const { data, error } = await supabase
      .from("vaults")
      .insert({ name: name.trim() })
      .select()
      .single()
    if (error || !data) {
      setSaving(false)
      return toast.error("فشل إنشاء الخزنة")
    }
    const links = selected.map((metal_id) => ({ vault_id: data.id, metal_id }))
    const { error: linkErr } = await supabase.from("vault_metals").insert(links)
    setSaving(false)
    if (linkErr) return toast.error("فشل ربط المعادن")
    toast.success("تم إنشاء الخزنة")
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة خزنة جديدة</DialogTitle>
          <DialogDescription>
            ادخل اسم الخزنة وحدد أنواع المعادن التي ستتعامل معها.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="vault-name">اسم الخزنة</Label>
            <Input
              id="vault-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: خزنة الذهب"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>أنواع المعادن</Label>
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              {metals.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selected.includes(m.id)}
                    onCheckedChange={() => toggle(m.id)}
                  />
                  {m.name_ar}
                </label>
              ))}
              {metals.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  لا توجد معادن مفعّلة. فعّل المعادن من إعدادات النظام أولاً.
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditVaultDialog({
  vault,
  metals,
  vaultMetals,
  inventory,
  onOpenChange,
  onSaved,
}: {
  vault: Vault | null
  metals: Metal[]
  vaultMetals: VaultMetal[]
  inventory: Inventory[]
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (vault) {
      setName(vault.name)
      setSelected(vaultMetals.filter((x) => x.vault_id === vault.id).map((x) => x.metal_id))
    }
  }, [vault, vaultMetals])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const metalHasWeight = (metalId: string) =>
    !!vault &&
    inventory.some(
      (i) => i.vault_id === vault.id && i.metal_id === metalId && Number(i.total_weight) > 0,
    )

  const submit = async () => {
    if (!vault) return
    if (!name.trim()) return toast.error("ادخل اسم الخزنة")
    if (selected.length === 0) return toast.error("اختر معدناً واحداً على الأقل")

    const original = vaultMetals.filter((x) => x.vault_id === vault.id).map((x) => x.metal_id)
    const toAdd = selected.filter((id) => !original.includes(id))
    const toRemove = original.filter((id) => !selected.includes(id))

    const blocked = toRemove.find((id) => metalHasWeight(id))
    if (blocked) {
      const m = metals.find((x) => x.id === blocked)
      return toast.error(`لا يمكن إزالة ${m?.name_ar ?? "المعدن"} لأنه يحتوي على وزن في الخزنة`)
    }

    setSaving(true)
    const { error } = await supabase
      .from("vaults")
      .update({ name: name.trim() })
      .eq("id", vault.id)
    if (error) {
      setSaving(false)
      return toast.error("فشل تعديل الخزنة")
    }

    if (toRemove.length > 0) {
      const { error: rmErr } = await supabase
        .from("vault_metals")
        .delete()
        .eq("vault_id", vault.id)
        .in("metal_id", toRemove)
      if (rmErr) {
        setSaving(false)
        return toast.error("فشل إزالة بعض المعادن")
      }
    }
    if (toAdd.length > 0) {
      const links = toAdd.map((metal_id) => ({ vault_id: vault.id, metal_id }))
      const { error: addErr } = await supabase.from("vault_metals").insert(links)
      if (addErr) {
        setSaving(false)
        return toast.error("فشل إضافة بعض المعادن")
      }
    }

    setSaving(false)
    toast.success("تم حفظ التعديلات")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={!!vault} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل الخزنة</DialogTitle>
          <DialogDescription>عدّل اسم الخزنة وأنواع المعادن المقبولة فيها.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-vault-name">اسم الخزنة</Label>
            <Input
              id="edit-vault-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>أنواع المعادن</Label>
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              {metals.map((m) => {
                const hasWeight = metalHasWeight(m.id)
                return (
                  <label
                    key={m.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={selected.includes(m.id)}
                        onCheckedChange={() => toggle(m.id)}
                        disabled={hasWeight && selected.includes(m.id)}
                      />
                      {m.name_ar}
                    </span>
                    {hasWeight && (
                      <span className="text-xs text-muted-foreground">
                        يحتوي على وزن — لا يمكن إزالته
                      </span>
                    )}
                  </label>
                )
              })}
              {metals.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  لا توجد معادن مفعّلة.
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default VaultsPage