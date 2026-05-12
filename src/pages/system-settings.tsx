import { useEffect, useState } from "react"
import { Coins, Database, Download, Upload, Eraser, Trash2, Plus, X, MoreHorizontal, Pencil, Loader2, Hash, ChevronDown, ChevronLeft, Power } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { ListSkeleton } from "@/components/loading-skeletons"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { buildChildrenMap, type CategoryNode } from "@/lib/category-tree"

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
        {/* Chevron at the start (right in RTL) */}
        {hasKids ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen((o) => !o)}
            title={open ? "طي" : "فتح"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "rotate-90"}`} />
          </Button>
        ) : (
          <span className="inline-block w-7" />
        )}

        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={node.name}>{node.name}</span>
        {node.requires_count && (
          <Badge variant="outline" className="shrink-0 text-xs">يتطلب عدد</Badge>
        )}

        {/* Actions at the end (left in RTL) */}
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { METAL_COLOR_PRESETS, getMetalPreset } from "@/lib/metal-colors"
import {
  formatNumber,
  setNumberFormatSettings,
  type DigitSystem,
} from "@/lib/number-format"
import { useNumberFormatSettings } from "@/hooks/use-number-format"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
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

type Metal = { id: string; code: string; name_ar: string; enabled: boolean; color: string; kind: "primary" | "additional" }
type Karat = { id: string; metal_id: string; karat: string }
type Category = CategoryNode
type MetalUsage = {
  vaults: string[]
  sections: string[]
  vaultInventory: string[]
  sectionInventory: string[]
  movements: number
}

export function SystemSettingsPage() {
  const [view, setView] = useState<"index" | "metals" | "data" | "numbers">("index")
  const { hasPermission } = usePermissions()
  const canMetals = hasPermission("manage_metals") || hasPermission("manage_categories")
  const canData =
    hasPermission("export_system_data") ||
    hasPermission("import_system_data") ||
    hasPermission("reset_system_movements") ||
    hasPermission("delete_system_data")
  const canNumbers = hasPermission("manage_number_format")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إعدادات النظام"
        description="ضبط الإعدادات العامة للنظام"
        onBack={view !== "index" ? () => setView("index") : undefined}
        breadcrumbs={
          view === "index"
            ? undefined
            : [{ label: "إعدادات النظام" }, { label: "تفاصيل" }]
        }
      />

      {view === "index" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canMetals && (
          <button
            type="button"
            onClick={() => setView("metals")}
            className="text-start"
          >
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                  <Coins className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">تحديد المعادن</h3>
                  <p className="text-sm text-muted-foreground">
                    تفعيل أو تعطيل أنواع المعادن
                  </p>
                </div>
              </CardContent>
            </Card>
          </button>
          )}
          {canData && (
          <button
            type="button"
            onClick={() => setView("data")}
            className="text-start"
          >
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">البيانات</h3>
                  <p className="text-sm text-muted-foreground">
                    تحميل، رفع، تصفير وحذف بيانات النظام
                  </p>
                </div>
              </CardContent>
            </Card>
          </button>
          )}
          {canNumbers && (
          <button
            type="button"
            onClick={() => setView("numbers")}
            className="text-start"
          >
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                  <Hash className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">أرقام الأوزان</h3>
                  <p className="text-sm text-muted-foreground">
                    نظام الأرقام والعلامات العشرية
                  </p>
                </div>
              </CardContent>
            </Card>
          </button>
          )}
          {!canMetals && !canData && !canNumbers && (
            <div className="col-span-full rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              لا تملك صلاحية لعرض أي قسم من إعدادات النظام
            </div>
          )}
        </div>
      )}

      {view === "metals" && <MetalsSettings />}
      {view === "data" && <DataSettings />}
      {view === "numbers" && <NumberFormatSettingsPanel />}
    </div>
  )
}

function NumberFormatSettingsPanel() {
  const settings = useNumberFormatSettings()
  const sample = 12345.6
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">نظام الأرقام</Label>
            <div className="flex gap-2">
              {([
                { v: "arabic", label: "أرقام عربية (0-9)" },
                { v: "hindi", label: "أرقام هندية (٠-٩)" },
              ] as { v: DigitSystem; label: string }[]).map((opt) => (
                <Button
                  key={opt.v}
                  type="button"
                  variant={settings.digitSystem === opt.v ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNumberFormatSettings({ digitSystem: opt.v })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium">فاصل الآلاف</span>
              <span className="text-xs text-muted-foreground">
                مثال: 10,000 بدلاً من 10000
              </span>
            </div>
            <Switch
              checked={settings.useThousandsSeparator}
              onCheckedChange={(v) =>
                setNumberFormatSettings({ useThousandsSeparator: !!v })
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">عدد الخانات العشرية</Label>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={settings.decimalPlaces === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNumberFormatSettings({ decimalPlaces: n })}
                  className="min-w-[2.5rem]"
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium">إظهار العلامات العشرية دائماً</span>
              <span className="text-xs text-muted-foreground">
                يضيف الأصفار جمب الرقم حتى لو مفيش كسر (مثال: 5.00)
              </span>
            </div>
            <Switch
              checked={settings.alwaysShowDecimals}
              onCheckedChange={(v) =>
                setNumberFormatSettings({ alwaysShowDecimals: !!v })
              }
            />
          </div>

          <div className="rounded-md border border-dashed border-border bg-background/50 px-3 py-3">
            <div className="text-xs text-muted-foreground mb-1">معاينة</div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-base font-semibold tabular-nums">
              <span>{formatNumber(sample)}</span>
              <span>{formatNumber(10000)}</span>
              <span>{formatNumber(5)}</span>
              <span>{formatNumber(0.5)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetalsSettings() {
  const { hasPermission } = usePermissions()
  const canMetals = hasPermission("manage_metals")
  const canCategories = hasPermission("manage_categories")
  const [metals, setMetals] = useState<Metal[]>([])
  const [karats, setKarats] = useState<Karat[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [renamingCat, setRenamingCat] = useState<Category | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [usage, setUsage] = useState<Record<string, MetalUsage>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Metal | "new" | null>(null)
  const [deleting, setDeleting] = useState<Metal | null>(null)
  const [karatInput, setKaratInput] = useState<Record<string, string>>({})
  const [catNameInput, setCatNameInput] = useState<Record<string, string>>({})
  const [catCountInput, setCatCountInput] = useState<Record<string, boolean>>({})
  const [addingChildOf, setAddingChildOf] = useState<Category | null>(null)
  const [childNameInput, setChildNameInput] = useState("")
  const [openMetals, setOpenMetals] = useState<Record<string, boolean>>({})

  const load = async () => {
    setLoading(true)
    const [m, k, c, vm, sm, vi, si, mv] = await Promise.all([
      supabase.from("metals").select("id,code,name_ar,enabled,color,kind").order("name_ar"),
      supabase.from("metal_karats").select("id,metal_id,karat").order("karat"),
      supabase.from("metal_categories").select("id,metal_id,name,requires_count,parent_id,sort_order").order("name"),
      supabase.from("vault_metals").select("metal_id, vaults(name)"),
      supabase.from("section_metals").select("metal_id, manufacturing_sections(name)"),
      supabase.from("vault_inventory").select("metal_id, total_weight, vaults(name)").gt("total_weight", 0),
      supabase.from("section_inventory").select("metal_id, total_weight, manufacturing_sections(name)").gt("total_weight", 0),
      supabase.from("movements").select("metal_id"),
    ])
    setMetals((m.data ?? []) as Metal[])
    setKarats((k.data ?? []) as Karat[])
    setCategories((c.data ?? []) as Category[])
    const u: Record<string, MetalUsage> = {}
    const ensure = (id: string) => {
      if (!u[id]) u[id] = { vaults: [], sections: [], vaultInventory: [], sectionInventory: [], movements: 0 }
      return u[id]
    }
    ;((vm.data ?? []) as Array<{ metal_id: string; vaults: { name: string } | null }>).forEach((r) => {
      if (r.vaults?.name) ensure(r.metal_id).vaults.push(r.vaults.name)
    })
    ;((sm.data ?? []) as Array<{ metal_id: string; manufacturing_sections: { name: string } | null }>).forEach((r) => {
      if (r.manufacturing_sections?.name) ensure(r.metal_id).sections.push(r.manufacturing_sections.name)
    })
    ;((vi.data ?? []) as Array<{ metal_id: string; vaults: { name: string } | null }>).forEach((r) => {
      if (r.vaults?.name) ensure(r.metal_id).vaultInventory.push(r.vaults.name)
    })
    ;((si.data ?? []) as Array<{ metal_id: string; manufacturing_sections: { name: string } | null }>).forEach((r) => {
      if (r.manufacturing_sections?.name) ensure(r.metal_id).sectionInventory.push(r.manufacturing_sections.name)
    })
    ;((mv.data ?? []) as Array<{ metal_id: string }>).forEach((r) => {
      ensure(r.metal_id).movements += 1
    })
    setUsage(u)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = async (m: Metal) => {
    const next = !m.enabled
    setMetals((arr) => arr.map((x) => (x.id === m.id ? { ...x, enabled: next } : x)))
    const { error } = await supabase.from("metals").update({ enabled: next }).eq("id", m.id)
    if (error) {
      toast.error("فشل التحديث")
      load()
    } else {
      toast.success("تم التحديث")
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const u = usage[deleting.id]
    const places: string[] = []
    if (u) {
      if (u.vaultInventory.length) places.push(`له رصيد في خزن: ${[...new Set(u.vaultInventory)].join("، ")}`)
      if (u.sectionInventory.length) places.push(`له رصيد في أقسام: ${[...new Set(u.sectionInventory)].join("، ")}`)
      if (u.movements > 0) places.push(`مستخدم في ${u.movements} حركة`)
      if (u.vaults.length) places.push(`مفعّل في خزن: ${[...new Set(u.vaults)].join("، ")}`)
      if (u.sections.length) places.push(`مفعّل في أقسام: ${[...new Set(u.sections)].join("، ")}`)
    }
    if (places.length) {
      toast.error(`لا يمكن الحذف — ${places.join(" • ")}`)
      setDeleting(null)
      return
    }
    const { error } = await supabase.from("metals").delete().eq("id", deleting.id)
    if (error) toast.error("فشل الحذف")
    else {
      toast.success("تم حذف المعدن")
      setDeleting(null)
      load()
    }
  }

  const addKarat = async (metalId: string) => {
    const value = (karatInput[metalId] ?? "").trim()
    if (!value) return
    // Optimistic insert with temp id; replace once server returns
    const tempId = `temp-${crypto.randomUUID()}`
    setKaratInput((s) => ({ ...s, [metalId]: "" }))
    setKarats((arr) => [...arr, { id: tempId, metal_id: metalId, karat: value }])
    const { data, error } = await supabase
      .from("metal_karats")
      .insert({ metal_id: metalId, karat: value })
      .select("id,metal_id,karat")
      .single()
    if (error || !data) {
      setKarats((arr) => arr.filter((x) => x.id !== tempId))
      toast.error(error.code === "23505" ? "العيار موجود بالفعل" : "فشل الإضافة")
      return
    }
    setKarats((arr) => arr.map((x) => (x.id === tempId ? (data as Karat) : x)))
  }

  const removeKarat = async (k: Karat) => {
    const { count } = await supabase
      .from("movements")
      .select("id", { count: "exact", head: true })
      .eq("metal_id", k.metal_id)
      .eq("karat", k.karat)
    if ((count ?? 0) > 0) {
      toast.error("لا يمكن حذف عيار مستخدم في الحركات")
      return
    }
    const { count: invCount } = await supabase
      .from("vault_inventory")
      .select("id", { count: "exact", head: true })
      .eq("metal_id", k.metal_id)
      .eq("karat", k.karat)
    if ((invCount ?? 0) > 0) {
      toast.error("لا يمكن حذف عيار له رصيد في الخزن")
      return
    }
    const { error } = await supabase.from("metal_karats").delete().eq("id", k.id)
    if (error) toast.error("فشل الحذف")
    else setKarats((arr) => arr.filter((x) => x.id !== k.id))
  }

  const addCategory = async (metalId: string) => {
    const name = (catNameInput[metalId] ?? "").trim()
    if (!name) return
    const requires_count = !!catCountInput[metalId]
    const { data, error } = await supabase
      .from("metal_categories")
      .insert({ metal_id: metalId, name, requires_count, parent_id: null })
      .select("id,metal_id,name,requires_count,parent_id,sort_order")
      .single()
    if (error || !data) {
      toast.error(error?.code === "23505" ? "التصنيف موجود بالفعل" : "فشل الإضافة")
      return
    }
    setCategories((arr) => [...arr, data as Category])
    setCatNameInput((s) => ({ ...s, [metalId]: "" }))
    setCatCountInput((s) => ({ ...s, [metalId]: false }))
  }

  const addChildCategory = async () => {
    if (!addingChildOf) return
    const name = childNameInput.trim()
    if (!name) return toast.error("ادخل اسم التصنيف")
    // Inherit requires_count from parent (rule enforced by DB anyway)
    const { data, error } = await supabase
      .from("metal_categories")
      .insert({
        metal_id: addingChildOf.metal_id,
        name,
        requires_count: addingChildOf.requires_count,
        parent_id: addingChildOf.id,
      })
      .select("id,metal_id,name,requires_count,parent_id,sort_order")
      .single()
    if (error || !data) {
      toast.error(error?.message ?? "فشل الإضافة")
      return
    }
    setCategories((arr) => [...arr, data as Category])
    setChildNameInput("")
    setAddingChildOf(null)
  }

  const toggleCategoryCount = async (cat: Category) => {
    const next = !cat.requires_count
    const { error } = await supabase
      .from("metal_categories")
      .update({ requires_count: next })
      .eq("id", cat.id)
    if (error) {
      toast.error(error.message ?? "فشل التحديث")
      return
    }
    setCategories((arr) => arr.map((x) => (x.id === cat.id ? { ...x, requires_count: next } : x)))
  }

  const removeCategory = async (cat: Category) => {
    const { count } = await supabase
      .from("movements")
      .select("id", { count: "exact", head: true })
      .eq("category_id", cat.id)
    if ((count ?? 0) > 0) {
      toast.error("لا يمكن حذف تصنيف مستخدم في الحركات")
      return
    }
    const { error } = await supabase.from("metal_categories").delete().eq("id", cat.id)
    if (error) toast.error("فشل الحذف")
    else setCategories((arr) => arr.filter((x) => x.id !== cat.id))
  }

  const renameCategory = async () => {
    if (!renamingCat) return
    const name = renameValue.trim()
    if (!name) return toast.error("ادخل اسم التصنيف")
    if (name === renamingCat.name) {
      setRenamingCat(null)
      return
    }
    const { error } = await supabase
      .from("metal_categories")
      .update({ name })
      .eq("id", renamingCat.id)
    if (error) {
      toast.error(error.code === "23505" ? "التصنيف موجود بالفعل" : "فشل التعديل")
      return
    }
    setCategories((arr) => arr.map((x) => (x.id === renamingCat.id ? { ...x, name } : x)))
    setRenamingCat(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setEditing("new")} disabled={!canMetals}>
          <Plus className="h-4 w-4" />
          إضافة معدن
        </Button>
      </div>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        metals.map((m) => {
          const preset = getMetalPreset(m.color)
          const ks = karats.filter((k) => k.metal_id === m.id)
          const cs = categories.filter((c) => c.metal_id === m.id)
          const u = usage[m.id]
          const usageItems: string[] = []
          if (u) {
            if (u.vaultInventory.length) usageItems.push(`رصيد في خزن: ${[...new Set(u.vaultInventory)].join("، ")}`)
            if (u.sectionInventory.length) usageItems.push(`رصيد في أقسام: ${[...new Set(u.sectionInventory)].join("، ")}`)
            if (u.movements > 0) usageItems.push(`${u.movements} حركة`)
            if (u.vaults.length) usageItems.push(`مفعّل في خزن: ${[...new Set(u.vaults)].join("، ")}`)
            if (u.sections.length) usageItems.push(`مفعّل في أقسام: ${[...new Set(u.sections)].join("، ")}`)
          }
          return (
            <Collapsible
              key={m.id}
              asChild
              open={!!openMetals[m.id]}
              onOpenChange={(o) => setOpenMetals((s) => ({ ...s, [m.id]: o }))}
            >
              <Card>
                <CardContent className="flex flex-col gap-3 py-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenMetals((s) => ({ ...s, [m.id]: !s[m.id] }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setOpenMetals((s) => ({ ...s, [m.id]: !s[m.id] }))
                      }
                    }}
                    className="flex items-center gap-2 min-w-0 cursor-pointer select-none -m-1 p-1 rounded-md hover:bg-muted/40"
                  >
                    <span
                      className="inline-block h-6 w-6 shrink-0 rounded-full ring-2 ring-border"
                      style={{ background: preset.swatch }}
                    />
                    <span className={cn("min-w-0 flex-1 truncate font-medium", preset.text)}>{m.name_ar}</span>
                    {m.kind === "primary" ? (
                      <Badge variant="default" className="shrink-0">أساسي</Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">إضافي</Badge>
                    )}
                    <div
                      className="flex shrink-0 items-center gap-1 ms-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" disabled={!canMetals}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(m)}>
                            <Pencil className="h-4 w-4" />
                            تعديل
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toggle(m)}>
                            <Power className="h-4 w-4" />
                            {m.enabled ? "تعطيل" : "تفعيل"}
                          </DropdownMenuItem>
                          {m.kind !== "primary" && (
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(m)}>
                              <Trash2 className="h-4 w-4" />
                              حذف
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={() => setOpenMetals((s) => ({ ...s, [m.id]: !s[m.id] }))}
                        aria-label={openMetals[m.id] ? "طي" : "فتح"}
                      >
                        <ChevronLeft className={cn("h-4 w-4 transition-transform", openMetals[m.id] && "-rotate-90")} />
                      </Button>
                    </div>
                  </div>

                  <CollapsibleContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{preset.label}</span>
                      <span className="ms-auto flex items-center gap-1.5">
                        مفعّل
                        <Switch checked={m.enabled} onCheckedChange={() => toggle(m)} disabled={!canMetals} />
                      </span>
                    </div>

                    <div className="rounded-md border border-dashed border-border bg-background/50 px-3 py-2 text-xs">
                    {usageItems.length === 0 ? (
                    <span className="text-muted-foreground">غير مستخدم — يمكن حذفه</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-muted-foreground">مستخدم في:</span>
                      <ul className="list-disc pr-5 text-foreground/80">
                        {usageItems.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                    </div>

                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">العيارات</div>
                  <div className="flex flex-wrap gap-2">
                    {ks.length === 0 && (
                      <span className="text-xs text-muted-foreground">لا توجد عيارات بعد</span>
                    )}
                    {ks.map((k) => (
                      <Badge
                        key={k.id}
                        variant="outline"
                        className={cn("gap-1.5 py-1", preset.text, preset.border)}
                      >
                        <span dir="ltr">{k.karat}</span>
                        <button
                          type="button"
                          onClick={() => removeKarat(k)}
                          className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive"
                          title="حذف"
                          disabled={!canMetals}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                   <div className="mt-3 flex flex-wrap gap-2">
                    <Input
                      value={karatInput[m.id] ?? ""}
                      onChange={(e) =>
                        setKaratInput((s) => ({ ...s, [m.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addKarat(m.id)
                        }
                      }}
                      placeholder="مثال: 999"
                      dir="ltr"
                      className="w-full sm:max-w-[160px]"
                    />
                    <Button size="sm" variant="outline" onClick={() => addKarat(m.id)} disabled={!canMetals} className="w-full sm:w-auto">
                      <Plus className="h-4 w-4" />
                      إضافة عيار
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">التصنيفات</div>
                  <div className="flex flex-col gap-2">
                    {cs.length === 0 && (
                      <span className="text-xs text-muted-foreground">لا توجد تصنيفات بعد</span>
                    )}
                    {(() => {
                      const childrenMap = buildChildrenMap(cs)
                      const roots = childrenMap.get(null) ?? []
                      return roots.map((root) => (
                        <CategoryTreeNode
                          key={root.id}
                          node={root}
                          childrenMap={childrenMap}
                          depth={0}
                          onToggleCount={toggleCategoryCount}
                          onAddChild={(c) => {
                            setChildNameInput("")
                            setAddingChildOf(c)
                          }}
                          onRename={(c) => {
                            setRenameValue(c.name)
                            setRenamingCat(c)
                          }}
                          onDelete={removeCategory}
                        />
                      ))
                    })()}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      value={catNameInput[m.id] ?? ""}
                      onChange={(e) =>
                        setCatNameInput((s) => ({ ...s, [m.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addCategory(m.id)
                        }
                      }}
                      placeholder="تصنيف رئيسي جديد (مثال: سبائك / مشغولات)"
                      className="max-w-[240px]"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch
                        checked={!!catCountInput[m.id]}
                        onCheckedChange={(v: boolean) =>
                          setCatCountInput((s) => ({ ...s, [m.id]: !!v }))
                        }
                      />
                      يتطلب عدد
                    </label>
                    <Button size="sm" variant="outline" onClick={() => addCategory(m.id)} disabled={!canCategories}>
                      <Plus className="h-4 w-4" />
                      إضافة تصنيف رئيسي
                    </Button>
                  </div>
                </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          )
        })
      )}

      <MetalEditorDialog
        open={editing !== null}
        metal={editing === "new" ? null : editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف المعدن</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف «{deleting?.name_ar}»؟ سيفشل الحذف لو كان مستخدماً في أي خزنة أو قسم أو حركة.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renamingCat !== null} onOpenChange={(o) => !o && setRenamingCat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل اسم التصنيف</DialogTitle>
            <DialogDescription>
              غيّر اسم التصنيف «{renamingCat?.name}».
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>الاسم</Label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  renameCategory()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingCat(null)}>
              إلغاء
            </Button>
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addChildCategory()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingChildOf(null)}>
              إلغاء
            </Button>
            <Button onClick={addChildCategory}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetalEditorDialog({
  open,
  metal,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  metal: Metal | null
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [color, setColor] = useState<string>("gold")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(metal?.name_ar ?? "")
    setCode(metal?.code ?? "")
    setColor(metal?.color ?? "gold")
  }, [open, metal])

  const submit = async () => {
    if (!name.trim()) return toast.error("أدخل اسم المعدن")
    if (!code.trim()) return toast.error("أدخل كود المعدن")
    setSaving(true)
    const payload = { name_ar: name.trim(), code: code.trim(), color }
    const { error } = metal
      ? await supabase.from("metals").update(payload).eq("id", metal.id)
      : await supabase.from("metals").insert({ ...payload, enabled: true })
    setSaving(false)
    if (error) {
      toast.error(error.code === "23505" ? "كود المعدن موجود بالفعل" : "فشل الحفظ")
      return
    }
    toast.success("تم الحفظ")
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{metal ? "تعديل المعدن" : "إضافة معدن جديد"}</DialogTitle>
          <DialogDescription>اختر اسم، كود، ولون المعدن.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="metal-name">الاسم</Label>
            <Input id="metal-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: ذهب" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="metal-code">الكود</Label>
            <Input
              id="metal-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="gold"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>اللون</Label>
            <div className="grid grid-cols-3 gap-2">
              {METAL_COLOR_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => setColor(p.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2 text-start text-xs transition-colors",
                    color === p.key
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <span
                    className="h-5 w-5 shrink-0 rounded-full ring-1 ring-border"
                    style={{ background: p.swatch }}
                  />
                  <span className={p.text}>{p.label}</span>
                </button>
              ))}
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

export default SystemSettingsPage

type ExportPayload = {
  version: 1
  exported_at: string
  vaults: any[]
  vault_metals: any[]
  vault_inventory: any[]
  manufacturing_sections: any[]
  section_metals: any[]
  section_inventory: any[]
  suppliers: any[]
  movements: any[]
  shifts: any[]
}

function DataSettings() {
  const { hasPermission } = usePermissions()
  const canExport = hasPermission("export_system_data")
  const canImport = hasPermission("import_system_data")
  const canReset = hasPermission("reset_system_movements")
  const canDeleteAll = hasPermission("delete_system_data")
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<null | "reset-movements" | "delete-all">(null)
  const [importPreview, setImportPreview] = useState<null | {
    summary: {
      table: string
      label: string
      total: number
      duplicates: number
      toInsert: number
      duplicateKeys: string[]
    }[]
    filtered: Partial<Record<keyof ExportPayload, any[]>>
  }>(null)

  const handleExport = async () => {
    setBusy("export")
    try {
      const tables = [
        "vaults",
        "vault_metals",
        "vault_inventory",
        "manufacturing_sections",
        "section_metals",
        "section_inventory",
        "suppliers",
        "movements",
        "shifts",
      ] as const
      const out: any = { version: 1, exported_at: new Date().toISOString() }
      for (const t of tables) {
        const { data, error } = await supabase.from(t).select("*")
        if (error) throw error
        out[t] = data ?? []
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `system-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("تم تحميل البيانات")
    } catch (e: any) {
      toast.error(e.message ?? "فشل التحميل")
    } finally {
      setBusy(null)
    }
  }

  const handleImport = async (file: File) => {
    setBusy("import")
    try {
      const text = await file.text()
      const data = JSON.parse(text) as ExportPayload
      if (!data || data.version !== 1) throw new Error("صيغة الملف غير صحيحة")

      const idTables: { table: keyof ExportPayload; label: string; field: string }[] = [
        { table: "vaults", label: "الخزن", field: "id" },
        { table: "manufacturing_sections", label: "أقسام التصنيع", field: "id" },
        { table: "suppliers", label: "الموردين", field: "id" },
        { table: "vault_inventory", label: "أرصدة الخزن", field: "id" },
        { table: "section_inventory", label: "أرصدة الأقسام", field: "id" },
        { table: "shifts", label: "الشيفتات", field: "id" },
        { table: "movements", label: "الحركات", field: "id" },
      ]
      const compositeTables: { table: keyof ExportPayload; label: string; keys: string[] }[] = [
        { table: "vault_metals", label: "معادن الخزن", keys: ["vault_id", "metal_id"] },
        { table: "section_metals", label: "معادن الأقسام", keys: ["section_id", "metal_id"] },
      ]

      const summary: {
        table: string
        label: string
        total: number
        duplicates: number
        toInsert: number
        duplicateKeys: string[]
      }[] = []
      const filtered: Partial<Record<keyof ExportPayload, any[]>> = {}

      for (const t of idTables) {
        const rows = (data[t.table] as any[]) ?? []
        if (!rows.length) {
          summary.push({ table: t.table, label: t.label, total: 0, duplicates: 0, toInsert: 0, duplicateKeys: [] })
          filtered[t.table] = []
          continue
        }
        const ids = rows.map((r) => r[t.field]).filter(Boolean)
        const existingIds = new Set<string>()
        const chunkSize = 500
        for (let i = 0; i < ids.length; i += chunkSize) {
          const slice = ids.slice(i, i + chunkSize)
          const { data: existing, error } = await supabase
            .from(t.table as any)
            .select(t.field)
            .in(t.field, slice)
          if (error) throw error
          for (const e of (existing ?? []) as any[]) existingIds.add(e[t.field])
        }
        const dupRows = rows.filter((r) => existingIds.has(r[t.field]))
        const newRows = rows.filter((r) => !existingIds.has(r[t.field]))
        summary.push({
          table: t.table,
          label: t.label,
          total: rows.length,
          duplicates: dupRows.length,
          toInsert: newRows.length,
          duplicateKeys: dupRows.map((r) => String(r[t.field])).slice(0, 5),
        })
        filtered[t.table] = newRows
      }

      for (const t of compositeTables) {
        const rows = (data[t.table] as any[]) ?? []
        if (!rows.length) {
          summary.push({ table: t.table, label: t.label, total: 0, duplicates: 0, toInsert: 0, duplicateKeys: [] })
          filtered[t.table] = []
          continue
        }
        const { data: existing, error } = await supabase.from(t.table as any).select(t.keys.join(","))
        if (error) throw error
        const existingSet = new Set<string>(
          ((existing ?? []) as any[]).map((e) => t.keys.map((k) => e[k]).join("|")),
        )
        const dupRows = rows.filter((r) => existingSet.has(t.keys.map((k) => r[k]).join("|")))
        const newRows = rows.filter((r) => !existingSet.has(t.keys.map((k) => r[k]).join("|")))
        summary.push({
          table: t.table,
          label: t.label,
          total: rows.length,
          duplicates: dupRows.length,
          toInsert: newRows.length,
          duplicateKeys: dupRows.map((r) => t.keys.map((k) => String(r[k]).slice(0, 6)).join(":")).slice(0, 5),
        })
        filtered[t.table] = newRows
      }

      setImportPreview({ summary, filtered })
    } catch (e: any) {
      toast.error(e.message ?? "فشل قراءة الملف")
    } finally {
      setBusy(null)
    }
  }

  const confirmImport = async () => {
    if (!importPreview) return
    setBusy("import")
    try {
      const order: (keyof ExportPayload)[] = [
        "vaults",
        "vault_metals",
        "vault_inventory",
        "manufacturing_sections",
        "section_metals",
        "section_inventory",
        "suppliers",
        "shifts",
        "movements",
      ]
      let insertedTotal = 0
      for (const t of order) {
        const rows = (importPreview.filtered[t] as any[]) ?? []
        if (!rows.length) continue
        const { error } = await supabase.from(t as any).insert(rows)
        if (error) throw error
        insertedTotal += rows.length
      }
      const skipped = importPreview.summary.reduce((s, r) => s + r.duplicates, 0)
      toast.success(`تم رفع ${insertedTotal} سجل، وتم تجاهل ${skipped} مكرر`)
      setImportPreview(null)
    } catch (e: any) {
      toast.error(e.message ?? "فشل الرفع")
    } finally {
      setBusy(null)
    }
  }

  const handleResetMovements = async () => {
    setBusy("reset")
    try {
      const { error } = await (supabase as any).rpc("admin_reset_movements")
      if (error) throw error
      toast.success("تم تصفير الحركات والأرصدة")
    } catch (e: any) {
      toast.error(e.message ?? "فشل التصفير")
    } finally {
      setBusy(null)
      setConfirmAction(null)
    }
  }

  const handleDeleteAll = async () => {
    setBusy("delete")
    try {
      const { error } = await (supabase as any).rpc("admin_delete_all_data")
      if (error) throw error
      toast.success("تم حذف كل البيانات")
    } catch (e: any) {
      toast.error(e.message ?? "فشل الحذف")
    } finally {
      setBusy(null)
      setConfirmAction(null)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Card>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">تحميل بيانات النظام</h3>
                <p className="text-sm text-muted-foreground">
                  تحميل نسخة كاملة من الخزن، الأقسام، الموردين والحركات
                </p>
              </div>
            </div>
            <Button onClick={handleExport} disabled={busy !== null || !canExport}>
              {busy === "export" && <Loader2 className="h-4 w-4 animate-spin" />}
              تحميل
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">رفع بيانات جاهزة</h3>
                <p className="text-sm text-muted-foreground">
                  ارفع ملف JSON بنفس صيغة التحميل. سيتم رفض أي كود مكرر.
                </p>
              </div>
            </div>
            <label className="inline-flex">
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                disabled={busy !== null || !canImport}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (f) handleImport(f)
                }}
              />
              <Button asChild disabled={busy !== null || !canImport}>
                <span className="inline-flex items-center gap-2">
                  {busy === "import" && <Loader2 className="h-4 w-4 animate-spin" />}
                  اختيار ملف
                </span>
              </Button>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Eraser className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">تصفير الحركات</h3>
                <p className="text-sm text-muted-foreground">
                  حذف كل الحركات والأرصدة مع الإبقاء على الخزن، الأقسام والموردين
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
              onClick={() => setConfirmAction("reset-movements")}
              disabled={busy !== null || !canReset}
            >
              تصفير
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">حذف كل البيانات</h3>
                <p className="text-sm text-muted-foreground">
                  حذف الخزن، الأقسام، الموردين والحركات. سيتم تفريغ السيستم بالكامل.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => setConfirmAction("delete-all")}
              disabled={busy !== null || !canDeleteAll}
            >
              حذف الكل
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmAction !== null} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "reset-movements" ? "تأكيد تصفير الحركات" : "تأكيد حذف كل البيانات"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "reset-movements"
                ? "سيتم حذف كل الحركات والشيفتات والأرصدة. لا يمكن التراجع عن هذه العملية."
                : "سيتم حذف كل الخزن، الأقسام، الموردين، الحركات والشيفتات. لا يمكن التراجع."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmAction === "delete-all"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
              onClick={(e) => {
                e.preventDefault()
                if (confirmAction === "reset-movements") handleResetMovements()
                else if (confirmAction === "delete-all") handleDeleteAll()
              }}
              disabled={busy !== null}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={importPreview !== null}
        onOpenChange={(o) => {
          if (!o && busy !== "import") setImportPreview(null)
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>مراجعة البيانات قبل الرفع</AlertDialogTitle>
            <AlertDialogDescription>
              راجع تفاصيل البيانات. أي سجل مكرر سيتم تجاهله تلقائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="px-3 py-2 text-start">الجدول</th>
                  <th className="px-3 py-2 text-center">إجمالي</th>
                  <th className="px-3 py-2 text-center">مكرر (سيتم تجاهله)</th>
                  <th className="px-3 py-2 text-center">سيتم رفعه</th>
                </tr>
              </thead>
              <tbody>
                {importPreview?.summary.map((r) => (
                  <tr key={r.table} className="border-t">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-center">{r.total}</td>
                    <td className="px-3 py-2 text-center text-amber-600">{r.duplicates}</td>
                    <td className="px-3 py-2 text-center text-emerald-600">{r.toInsert}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {importPreview && importPreview.summary.some((r) => r.duplicates > 0) && (
            <p className="text-xs text-muted-foreground">
              يوجد سجلات مكررة سيتم تجاهلها والاستمرار في رفع الباقي.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "import"}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmImport()
              }}
              disabled={
                busy === "import" ||
                !importPreview ||
                importPreview.summary.every((r) => r.toInsert === 0)
              }
            >
              {busy === "import" && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد الرفع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}