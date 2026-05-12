import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Trash2, Plus, X, MoreHorizontal, Pencil, ChevronDown } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { ListSkeleton } from "@/components/loading-skeletons"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { buildChildrenMap, type CategoryNode } from "@/lib/category-tree"
import { getMetalPreset } from "@/lib/metal-colors"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
import { MetalEditorDialog } from "@/pages/system-settings"

type Metal = { id: string; code: string; name_ar: string; color: string; kind: "primary" | "additional" }
type Karat = { id: string; metal_id: string; karat: string }
type Category = CategoryNode
type MetalUsage = {
  vaults: string[]
  sections: string[]
  vaultInventory: string[]
  sectionInventory: string[]
  movements: number
}

function CategoryTreeNode({
  node,
  childrenMap,
  depth,
  onToggleCount,
  onAddChild,
  onRename,
  onDelete,
}: {
  node: Category
  childrenMap: Map<string | null, Category[]>
  depth: number
  onToggleCount: (c: Category) => void
  onAddChild: (c: Category) => void
  onRename: (c: Category) => void
  onDelete: (c: Category) => void
}) {
  const kids = childrenMap.get(node.id) ?? []
  const hasKids = kids.length > 0
  const isRoot = depth === 0
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-1" style={{ marginInlineStart: depth * 16 }}>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5">
        {hasKids ? (
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen((o) => !o)} title={open ? "طي" : "فتح"}>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "rotate-90"}`} />
          </Button>
        ) : (
          <span className="inline-block w-7" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={node.name}>{node.name}</span>
        <div className="flex shrink-0 items-center gap-1 ms-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onRename(node)}>
                <Pencil className="h-4 w-4" />
                تعديل الاسم
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(node)}>
                <Trash2 className="h-4 w-4" />
                حذف التصنيف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isRoot && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground mx-1">
              <Switch checked={node.requires_count} onCheckedChange={() => onToggleCount(node)} />
              عدد
            </label>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => onAddChild(node)} title="إضافة تصنيف فرعي">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {hasKids && open && (
        <div className="flex flex-col gap-1 ps-2">
          {kids.map((k) => (
            <CategoryTreeNode
              key={k.id}
              node={k}
              childrenMap={childrenMap}
              depth={depth + 1}
              onToggleCount={onToggleCount}
              onAddChild={onAddChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function MetalDetailPage() {
  const { metalId } = useParams<{ metalId: string }>()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canMetals = hasPermission("manage_metals")
  const canCategories = hasPermission("manage_categories")

  const [loading, setLoading] = useState(true)
  const [metal, setMetal] = useState<Metal | null>(null)
  const [karats, setKarats] = useState<Karat[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [usage, setUsage] = useState<MetalUsage | null>(null)

  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [karatInput, setKaratInput] = useState("")
  const [catNameInput, setCatNameInput] = useState("")
  const [catCountInput, setCatCountInput] = useState(false)
  const [renamingCat, setRenamingCat] = useState<Category | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [addingChildOf, setAddingChildOf] = useState<Category | null>(null)
  const [childNameInput, setChildNameInput] = useState("")

  const load = async () => {
    if (!metalId) return
    setLoading(true)
    const [m, k, c, vm, sm, vi, si, mv] = await Promise.all([
      supabase.from("metals").select("id,code,name_ar,enabled,color,kind").eq("id", metalId).maybeSingle(),
      supabase.from("metal_karats").select("id,metal_id,karat").eq("metal_id", metalId).order("karat"),
      supabase.from("metal_categories").select("id,metal_id,name,requires_count,parent_id,sort_order").eq("metal_id", metalId).order("name"),
      supabase.from("vault_metals").select("metal_id, vaults(name)").eq("metal_id", metalId),
      supabase.from("section_metals").select("metal_id, manufacturing_sections(name)").eq("metal_id", metalId),
      supabase.from("vault_inventory").select("metal_id, total_weight, vaults(name)").eq("metal_id", metalId).gt("total_weight", 0),
      supabase.from("section_inventory").select("metal_id, total_weight, manufacturing_sections(name)").eq("metal_id", metalId).gt("total_weight", 0),
      supabase.from("movements").select("id", { count: "exact", head: true }).eq("metal_id", metalId),
    ])
    setMetal((m.data as Metal | null) ?? null)
    setKarats((k.data ?? []) as Karat[])
    setCategories((c.data ?? []) as Category[])
    const u: MetalUsage = { vaults: [], sections: [], vaultInventory: [], sectionInventory: [], movements: 0 }
    ;((vm.data ?? []) as Array<{ vaults: { name: string } | null }>).forEach((r) => { if (r.vaults?.name) u.vaults.push(r.vaults.name) })
    ;((sm.data ?? []) as Array<{ manufacturing_sections: { name: string } | null }>).forEach((r) => { if (r.manufacturing_sections?.name) u.sections.push(r.manufacturing_sections.name) })
    ;((vi.data ?? []) as Array<{ vaults: { name: string } | null }>).forEach((r) => { if (r.vaults?.name) u.vaultInventory.push(r.vaults.name) })
    ;((si.data ?? []) as Array<{ manufacturing_sections: { name: string } | null }>).forEach((r) => { if (r.manufacturing_sections?.name) u.sectionInventory.push(r.manufacturing_sections.name) })
    u.movements = mv.count ?? 0
    setUsage(u)
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [metalId])

  const toggle = async () => {
    if (!metal) return
    const next = !metal.enabled
    setMetal({ ...metal, enabled: next })
    const { error } = await supabase.from("metals").update({ enabled: next }).eq("id", metal.id)
    if (error) { toast.error("فشل التحديث"); load() } else toast.success("تم التحديث")
  }

  const confirmDelete = async () => {
    if (!metal || !usage) return
    const places: string[] = []
    if (usage.vaultInventory.length) places.push(`له رصيد في خزن: ${[...new Set(usage.vaultInventory)].join("، ")}`)
    if (usage.sectionInventory.length) places.push(`له رصيد في أقسام: ${[...new Set(usage.sectionInventory)].join("، ")}`)
    if (usage.movements > 0) places.push(`مستخدم في ${usage.movements} حركة`)
    if (usage.vaults.length) places.push(`مفعّل في خزن: ${[...new Set(usage.vaults)].join("، ")}`)
    if (usage.sections.length) places.push(`مفعّل في أقسام: ${[...new Set(usage.sections)].join("، ")}`)
    if (places.length) { toast.error(`لا يمكن الحذف — ${places.join(" • ")}`); setDeleting(false); return }
    const { error } = await supabase.from("metals").delete().eq("id", metal.id)
    if (error) toast.error("فشل الحذف")
    else { toast.success("تم حذف المعدن"); navigate("/system-settings") }
  }

  const addKarat = async () => {
    if (!metal) return
    const value = karatInput.trim()
    if (!value) return
    const tempId = `temp-${crypto.randomUUID()}`
    setKaratInput("")
    setKarats((arr) => [...arr, { id: tempId, metal_id: metal.id, karat: value }])
    const { data, error } = await supabase
      .from("metal_karats")
      .insert({ metal_id: metal.id, karat: value })
      .select("id,metal_id,karat")
      .single()
    if (error || !data) {
      setKarats((arr) => arr.filter((x) => x.id !== tempId))
      toast.error(error?.code === "23505" ? "العيار موجود بالفعل" : "فشل الإضافة")
      return
    }
    setKarats((arr) => arr.map((x) => (x.id === tempId ? (data as Karat) : x)))
  }

  const removeKarat = async (k: Karat) => {
    const { count } = await supabase.from("movements").select("id", { count: "exact", head: true }).eq("metal_id", k.metal_id).eq("karat", k.karat)
    if ((count ?? 0) > 0) { toast.error("لا يمكن حذف عيار مستخدم في الحركات"); return }
    const { count: invCount } = await supabase.from("vault_inventory").select("id", { count: "exact", head: true }).eq("metal_id", k.metal_id).eq("karat", k.karat)
    if ((invCount ?? 0) > 0) { toast.error("لا يمكن حذف عيار له رصيد في الخزن"); return }
    const { error } = await supabase.from("metal_karats").delete().eq("id", k.id)
    if (error) toast.error("فشل الحذف")
    else setKarats((arr) => arr.filter((x) => x.id !== k.id))
  }

  const addCategory = async () => {
    if (!metal) return
    const name = catNameInput.trim()
    if (!name) return
    const { data, error } = await supabase
      .from("metal_categories")
      .insert({ metal_id: metal.id, name, requires_count: catCountInput, parent_id: null })
      .select("id,metal_id,name,requires_count,parent_id,sort_order")
      .single()
    if (error || !data) { toast.error(error?.code === "23505" ? "التصنيف موجود بالفعل" : "فشل الإضافة"); return }
    setCategories((arr) => [...arr, data as Category])
    setCatNameInput("")
    setCatCountInput(false)
  }

  const addChildCategory = async () => {
    if (!addingChildOf) return
    const name = childNameInput.trim()
    if (!name) return toast.error("ادخل اسم التصنيف")
    const { data, error } = await supabase
      .from("metal_categories")
      .insert({ metal_id: addingChildOf.metal_id, name, requires_count: addingChildOf.requires_count, parent_id: addingChildOf.id })
      .select("id,metal_id,name,requires_count,parent_id,sort_order")
      .single()
    if (error || !data) { toast.error(error?.message ?? "فشل الإضافة"); return }
    setCategories((arr) => [...arr, data as Category])
    setChildNameInput("")
    setAddingChildOf(null)
  }

  const toggleCategoryCount = async (cat: Category) => {
    const next = !cat.requires_count
    const { error } = await supabase.from("metal_categories").update({ requires_count: next }).eq("id", cat.id)
    if (error) { toast.error(error.message ?? "فشل التحديث"); return }
    setCategories((arr) => arr.map((x) => (x.id === cat.id ? { ...x, requires_count: next } : x)))
  }

  const removeCategory = async (cat: Category) => {
    const { count } = await supabase.from("movements").select("id", { count: "exact", head: true }).eq("category_id", cat.id)
    if ((count ?? 0) > 0) { toast.error("لا يمكن حذف تصنيف مستخدم في الحركات"); return }
    const { error } = await supabase.from("metal_categories").delete().eq("id", cat.id)
    if (error) toast.error("فشل الحذف")
    else setCategories((arr) => arr.filter((x) => x.id !== cat.id))
  }

  const renameCategory = async () => {
    if (!renamingCat) return
    const name = renameValue.trim()
    if (!name) return toast.error("ادخل اسم التصنيف")
    if (name === renamingCat.name) { setRenamingCat(null); return }
    const { error } = await supabase.from("metal_categories").update({ name }).eq("id", renamingCat.id)
    if (error) { toast.error(error.code === "23505" ? "التصنيف موجود بالفعل" : "فشل التعديل"); return }
    setCategories((arr) => arr.map((x) => (x.id === renamingCat.id ? { ...x, name } : x)))
    setRenamingCat(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تفاصيل المعدن" onBack={() => navigate("/system-settings")} />
        <ListSkeleton rows={4} />
      </div>
    )
  }

  if (!metal) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="المعدن غير موجود" onBack={() => navigate("/system-settings")} />
      </div>
    )
  }

  const preset = getMetalPreset(metal.color)
  const usageItems: string[] = []
  if (usage) {
    if (usage.vaultInventory.length) usageItems.push(`رصيد في خزن: ${[...new Set(usage.vaultInventory)].join("، ")}`)
    if (usage.sectionInventory.length) usageItems.push(`رصيد في أقسام: ${[...new Set(usage.sectionInventory)].join("، ")}`)
    if (usage.movements > 0) usageItems.push(`${usage.movements} حركة`)
    if (usage.vaults.length) usageItems.push(`مفعّل في خزن: ${[...new Set(usage.vaults)].join("، ")}`)
    if (usage.sections.length) usageItems.push(`مفعّل في أقسام: ${[...new Set(usage.sections)].join("، ")}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={metal.name_ar}
        description="إدارة العيارات والتصنيفات الخاصة بالمعدن"
        onBack={() => navigate("/system-settings")}
        breadcrumbs={[{ label: "إعدادات النظام", to: "/system-settings" }, { label: "تحديد المعادن" }, { label: metal.name_ar }]}
      />

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-block h-7 w-7 shrink-0 rounded-full ring-2 ring-border" style={{ background: preset.swatch }} />
            <span className={cn("min-w-0 flex-1 truncate font-medium text-base", preset.text)}>{metal.name_ar}</span>
            {metal.kind === "primary" ? (
              <Badge variant="default" className="shrink-0">أساسي</Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0">إضافي</Badge>
            )}
            <div className="flex shrink-0 items-center gap-1 ms-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground" disabled={!canMetals}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" />
                    تعديل
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toggle()}>
                    <Power className="h-4 w-4" />
                    {metal.enabled ? "تعطيل" : "تفعيل"}
                  </DropdownMenuItem>
                  {metal.kind !== "primary" && (
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{preset.label}</span>
            <span className="ms-auto flex items-center gap-1.5">
              مفعّل
              <Switch checked={metal.enabled} onCheckedChange={() => toggle()} disabled={!canMetals} />
            </span>
          </div>

          <div className="rounded-md border border-dashed border-border bg-background/50 px-3 py-2 text-xs">
            {usageItems.length === 0 ? (
              <span className="text-muted-foreground">غير مستخدم — يمكن حذفه</span>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground">مستخدم في:</span>
                <ul className="list-disc pr-5 text-foreground/80">
                  {usageItems.map((t, i) => (<li key={i}>{t}</li>))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <div className="mb-2 text-sm font-semibold">العيارات</div>
          <div className="flex flex-wrap gap-2">
            {karats.length === 0 && (<span className="text-xs text-muted-foreground">لا توجد عيارات بعد</span>)}
            {karats.map((k) => (
              <Badge key={k.id} variant="outline" className={cn("gap-1.5 py-1", preset.text, preset.border)}>
                <span dir="ltr">{k.karat}</span>
                <button type="button" onClick={() => removeKarat(k)} className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive" title="حذف" disabled={!canMetals}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              value={karatInput}
              onChange={(e) => setKaratInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKarat() } }}
              placeholder="مثال: 999"
              dir="ltr"
              className="w-full sm:max-w-[160px]"
            />
            <Button size="sm" variant="outline" onClick={addKarat} disabled={!canMetals} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              إضافة عيار
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <div className="mb-2 text-sm font-semibold">التصنيفات</div>
          <div className="flex flex-col gap-2">
            {categories.length === 0 && (<span className="text-xs text-muted-foreground">لا توجد تصنيفات بعد</span>)}
            {(() => {
              const childrenMap = buildChildrenMap(categories)
              const roots = childrenMap.get(null) ?? []
              return roots.map((root) => (
                <CategoryTreeNode
                  key={root.id}
                  node={root}
                  childrenMap={childrenMap}
                  depth={0}
                  onToggleCount={toggleCategoryCount}
                  onAddChild={(c) => { setChildNameInput(""); setAddingChildOf(c) }}
                  onRename={(c) => { setRenameValue(c.name); setRenamingCat(c) }}
                  onDelete={removeCategory}
                />
              ))
            })()}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              value={catNameInput}
              onChange={(e) => setCatNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory() } }}
              placeholder="تصنيف رئيسي جديد (مثال: سبائك / مشغولات)"
              className="max-w-[240px]"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Switch checked={catCountInput} onCheckedChange={(v: boolean) => setCatCountInput(!!v)} />
              يتطلب عدد
            </label>
            <Button size="sm" variant="outline" onClick={addCategory} disabled={!canCategories}>
              <Plus className="h-4 w-4" />
              إضافة تصنيف رئيسي
            </Button>
          </div>
        </CardContent>
      </Card>

      <MetalEditorDialog
        open={editing}
        metal={metal}
        onOpenChange={(o) => !o && setEditing(false)}
        onSaved={() => { setEditing(false); load() }}
      />

      <Dialog open={deleting} onOpenChange={(o: boolean) => !o && setDeleting(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف المعدن</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف «{metal.name_ar}»؟ سيفشل الحذف لو كان مستخدماً في أي خزنة أو قسم أو حركة.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={confirmDelete}>حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renamingCat !== null} onOpenChange={(o) => !o && setRenamingCat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل اسم التصنيف</DialogTitle>
            <DialogDescription>غيّر اسم التصنيف «{renamingCat?.name}».</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>الاسم</Label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); renameCategory() } }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingCat(null)}>إلغاء</Button>
            <Button onClick={renameCategory}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingChildOf !== null} onOpenChange={(o) => !o && setAddingChildOf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة تصنيف فرعي</DialogTitle>
            <DialogDescription>
              تحت «{addingChildOf?.name}». سيرث «يتطلب عدد» من الأب تلقائياً ({addingChildOf?.requires_count ? "نعم" : "لا"}).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>اسم التصنيف الفرعي</Label>
            <Input
              value={childNameInput}
              onChange={(e) => setChildNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChildCategory() } }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingChildOf(null)}>إلغاء</Button>
            <Button onClick={addChildCategory}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MetalDetailPage
