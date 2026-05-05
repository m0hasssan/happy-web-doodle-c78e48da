import { useEffect, useState } from "react"
import { MoreVertical, Plus, Trash2, Pencil, Vault as VaultIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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

type Metal = { id: string; code: string; name_ar: string; enabled: boolean }
type Vault = { id: string; name: string }
type VaultMetal = { vault_id: string; metal_id: string }
type Inventory = { vault_id: string; metal_id: string; total_weight: number }

export function VaultsPage() {
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
      supabase.from("metals").select("*").eq("enabled", true).order("name_ar"),
      supabase.from("vaults").select("*").order("created_at"),
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
        const w = inventory.find((i) => i.vault_id === vaultId && i.metal_id === m.id)?.total_weight ?? 0
        return { metal: m, weight: Number(w) }
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الخزن"
        description="إدارة خزن المعادن في النظام"
        actions={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            إضافة خزنة جديدة
          </Button>
        }
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
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
            return (
              <Card key={v.id} className="relative">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                      <VaultIcon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{v.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(v)}>
                        <Pencil className="h-4 w-4" />
                        تعديل
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleDeleteRequest(v)}
                      >
                        <Trash2 className="h-4 w-4" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="pt-0">
                  {empty ? (
                    <p className="rounded-md bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
                      الخزنة فارغة
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {totals.map((t) => (
                        <li
                          key={t.metal.id}
                          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">{t.metal.name_ar}</span>
                          <span className="font-semibold tabular-nums">
                            {t.weight.toLocaleString("ar-EG", { maximumFractionDigits: 3 })} جم
                          </span>
                        </li>
                      ))}
                    </ul>
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
  onOpenChange,
  onSaved,
}: {
  vault: Vault | null
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (vault) setName(vault.name)
  }, [vault])

  const submit = async () => {
    if (!vault) return
    if (!name.trim()) return toast.error("ادخل اسم الخزنة")
    setSaving(true)
    const { error } = await supabase
      .from("vaults")
      .update({ name: name.trim() })
      .eq("id", vault.id)
    setSaving(false)
    if (error) return toast.error("فشل تعديل الخزنة")
    toast.success("تم حفظ التعديلات")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={!!vault} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل الخزنة</DialogTitle>
          <DialogDescription>يمكنك تعديل اسم الخزنة فقط.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-vault-name">اسم الخزنة</Label>
          <Input
            id="edit-vault-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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