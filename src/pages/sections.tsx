import { useEffect, useState } from "react"
import { MoreVertical, Plus, Trash2, Pencil, Factory as SectionIcon, Power, ArrowLeft, Settings as SettingsIcon } from "lucide-react"
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
import { SectionSettingsDialog } from "@/components/section-settings-dialog"

type Metal = { id: string; code: string; name_ar: string; enabled: boolean; color: string }
type Section = { id: string; name: string; status: string }
type SectionMetal = { section_id: string; metal_id: string }
type Inventory = { section_id: string; metal_id: string; total_weight: number }
type Shrinkage = { section_id: string; metal_id: string; pure_999_weight: number }

export function SectionsPage() {
  const { hasPermission, loading: permLoading } = usePermissions()
  const canView = hasPermission("view_sections")
  const canCreate = hasPermission("create_section")
  const [metals, setMetals] = useState<Metal[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [sectionMetals, setSectionMetals] = useState<SectionMetal[]>([])
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [shrinkage, setShrinkage] = useState<Shrinkage[]>([])
  const [loading, setLoading] = useState(true)

  // dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Section | null>(null)
  const [deleting, setDeleting] = useState<Section | null>(null)
  const [hasWeightAlert, setHasWeightAlert] = useState<Section | null>(null)
  const [settingsFor, setSettingsFor] = useState<Section | null>(null)

  const loadAll = async () => {
    setLoading(true)
    const [m, v, vm, inv, sh] = await Promise.all([
      supabase.from("metals").select("id,code,name_ar,enabled,color").eq("enabled", true).order("name_ar"),
      supabase.from("manufacturing_sections").select("id,name,status").eq("kind", "manufacturing").order("created_at"),
      supabase.from("section_metals").select("*"),
      supabase.from("section_inventory").select("section_id, metal_id, total_weight"),
      supabase.from("work_order_shrinkage").select("section_id, metal_id, pure_999_weight"),
    ])
    setMetals((m.data ?? []) as Metal[])
    setSections((v.data ?? []) as Section[])
    setSectionMetals((vm.data ?? []) as SectionMetal[])
    setInventory((inv.data ?? []) as Inventory[])
    setShrinkage((sh.data ?? []) as Shrinkage[])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const totalsForSection = (sectionId: string) => {
    const sMetalIds = sectionMetals.filter((x) => x.section_id === sectionId).map((x) => x.metal_id)
    return metals
      .filter((m) => sMetalIds.includes(m.id))
      .map((m) => {
        const w = inventory
          .filter((i) => i.section_id === sectionId && i.metal_id === m.id)
          .reduce((s, i) => s + Number(i.total_weight), 0)
        const sh = shrinkage
          .filter((s) => s.section_id === sectionId && s.metal_id === m.id)
          .reduce((s, x) => s + Number(x.pure_999_weight), 0)
        return { metal: m, weight: Math.max(0, w - sh) }
      })
  }

  const sectionHasWeight = (sectionId: string) =>
    inventory.some((i) => i.section_id === sectionId && Number(i.total_weight) > 0)

  const handleDeleteRequest = (v: Section) => {
    if (sectionHasWeight(v.id)) {
      setHasWeightAlert(v)
    } else {
      setDeleting(v)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const { error } = await supabase.from("manufacturing_sections").delete().eq("id", deleting.id)
    if (error) {
      toast.error("فشل حذف القسم")
    } else {
      toast.success("تم حذف القسم")
      setDeleting(null)
      loadAll()
    }
  }

  const toggleStatus = async (v: Section) => {
    const next = v.status === "active" ? "disabled" : "active"
    const { error } = await supabase.from("manufacturing_sections").update({ status: next }).eq("id", v.id)
    if (error) return toast.error("فشل تغيير حالة القسم")
    toast.success(next === "active" ? "تم تنشيط القسم" : "تم تعطيل القسم")
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
          </CardContent>
        </Card>
      </div>
    ) : (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="أقسام التصنيع"
        description="إدارة أقسام التصنيع في النظام"
        actions={
          canCreate ? (
            <Button className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              إضافة قسم جديد
            </Button>
          ) : null
        }
      />

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <SectionIcon className="h-10 w-10" />
            <p>لا توجد أقسام بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((v) => {
            const totals = totalsForSection(v.id)
            const empty = totals.every((t) => t.weight === 0)
            const canAccess = hasPermission("access_section", v.id)
            const canEdit = hasPermission("edit_section", v.id)
            const canDelete = hasPermission("delete_section", v.id)
            return (
              <Card key={v.id} className="relative">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                      <SectionIcon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{v.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={v.status === "active" ? "default" : "secondary"}>
                      {v.status === "active" ? "نشط" : "معطل"}
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
                        {v.status === "active" ? "تعطيل القسم" : "تنشيط القسم"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSettingsFor(v)} disabled={!canEdit}>
                        <SettingsIcon className="h-4 w-4" />
                        إعدادات القسم
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
                <CardContent className="flex flex-col gap-3 pt-0">
                  {empty ? (
                    <p className="rounded-md bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
                      القسم فارغ
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
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
                  <Button asChild variant="outline" className="w-full gap-2" disabled={v.status !== "active"}>
                    {v.status === "active" ? (
                      <Link to={`/sections/${v.id}`}>
                        الدخول للقسم
                        <ArrowLeft className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span>
                        القسم معطل
                        <ArrowLeft className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AddSectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        metals={metals}
        onCreated={loadAll}
      />

      <EditSectionDialog
        section={editing}
        metals={metals}
        sectionMetals={sectionMetals}
        inventory={inventory}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={loadAll}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من رغبتك في حذف القسم؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف القسم «{deleting?.name}» نهائياً ولا يمكن التراجع عن هذه العملية.
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
            <AlertDialogTitle>لا يمكن حذف القسم</AlertDialogTitle>
            <AlertDialogDescription>
              القسم «{hasWeightAlert?.name}» يحتوي على وزن من المعادن. يجب تفريغه أولاً قبل حذفه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setHasWeightAlert(null)}>حسناً</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SectionSettingsDialog
        open={!!settingsFor}
        onOpenChange={(o) => !o && setSettingsFor(null)}
        sectionId={settingsFor?.id ?? null}
        sectionName={settingsFor?.name}
      />
    </div>
    )
  )
}

function AddSectionDialog({
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
    if (!name.trim()) return toast.error("ادخل اسم القسم")
    if (selected.length === 0) return toast.error("اختر معدناً واحداً على الأقل")
    setSaving(true)
    const { data, error } = await supabase
      .from("manufacturing_sections")
      .insert({ name: name.trim(), kind: "manufacturing" })
      .select()
      .single()
    if (error || !data) {
      setSaving(false)
      return toast.error("فشل إنشاء القسم")
    }
    const links = selected.map((metal_id) => ({ section_id: data.id, metal_id }))
    const { error: linkErr } = await supabase.from("section_metals").insert(links)
    setSaving(false)
    if (linkErr) return toast.error("فشل ربط المعادن")
    toast.success("تم إنشاء القسم")
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة قسم جديد</DialogTitle>
          <DialogDescription>
            ادخل اسم القسم وحدد أنواع المعادن التي ستتعامل معها.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="section-name">اسم القسم</Label>
            <Input
              id="section-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: قسم السبك"
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

function EditSectionDialog({
  section,
  metals,
  sectionMetals,
  inventory,
  onOpenChange,
  onSaved,
}: {
  section: Section | null
  metals: Metal[]
  sectionMetals: SectionMetal[]
  inventory: Inventory[]
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (section) {
      setName(section.name)
      setSelected(sectionMetals.filter((x) => x.section_id === section.id).map((x) => x.metal_id))
    }
  }, [section, sectionMetals])

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const metalHasWeight = (metalId: string) =>
    !!section &&
    inventory.some(
      (i) => i.section_id === section.id && i.metal_id === metalId && Number(i.total_weight) > 0,
    )

  const submit = async () => {
    if (!section) return
    if (!name.trim()) return toast.error("ادخل اسم القسم")
    if (selected.length === 0) return toast.error("اختر معدناً واحداً على الأقل")

    const original = sectionMetals.filter((x) => x.section_id === section.id).map((x) => x.metal_id)
    const toAdd = selected.filter((id) => !original.includes(id))
    const toRemove = original.filter((id) => !selected.includes(id))

    const blocked = toRemove.find((id) => metalHasWeight(id))
    if (blocked) {
      const m = metals.find((x) => x.id === blocked)
      return toast.error(`لا يمكن إزالة ${m?.name_ar ?? "المعدن"} لأنه يحتوي على وزن في القسم`)
    }

    setSaving(true)
    const { error } = await supabase
      .from("manufacturing_sections")
      .update({ name: name.trim() })
      .eq("id", section.id)
    if (error) {
      setSaving(false)
      return toast.error("فشل تعديل القسم")
    }

    if (toRemove.length > 0) {
      const { error: rmErr } = await supabase
        .from("section_metals")
        .delete()
        .eq("section_id", section.id)
        .in("metal_id", toRemove)
      if (rmErr) {
        setSaving(false)
        return toast.error("فشل إزالة بعض المعادن")
      }
    }
    if (toAdd.length > 0) {
      const links = toAdd.map((metal_id) => ({ section_id: section.id, metal_id }))
      const { error: addErr } = await supabase.from("section_metals").insert(links)
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
    <Dialog open={!!section} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل القسم</DialogTitle>
          <DialogDescription>عدّل اسم القسم وأنواع المعادن المقبولة فيه.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-section-name">اسم القسم</Label>
            <Input
              id="edit-section-name"
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
                <p className="text-xs text-muted-foreground">لا توجد معادن مفعّلة.</p>
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

export default SectionsPage