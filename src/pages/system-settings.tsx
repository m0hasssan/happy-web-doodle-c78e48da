import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Coins, Database, Download, Upload, Eraser, Trash2, Plus, Loader2, Hash, ChevronLeft } from "lucide-react"
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
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canMetals = hasPermission("manage_metals")
  const [metals, setMetals] = useState<Metal[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Metal | "new" | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("metals")
      .select("id,code,name_ar,enabled,color,kind")
      .order("name_ar")
    setMetals((data ?? []) as Metal[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

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
        <Card className="p-2">
          <nav className="flex flex-col gap-1">
            {metals.map((m) => {
              const preset = getMetalPreset(m.color)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navigate(`/system-settings/metals/${m.id}`)}
                  className="flex items-center gap-3 rounded-md p-3 text-right transition-colors hover:bg-muted"
                >
                  <span
                    className="inline-block h-6 w-6 shrink-0 rounded-full ring-2 ring-border"
                    style={{ background: preset.swatch }}
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={cn("min-w-0 truncate text-sm font-medium", preset.text)}>
                      {m.name_ar}
                    </span>
                    {m.kind === "primary" ? (
                      <Badge variant="default" className="shrink-0">أساسي</Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">إضافي</Badge>
                    )}
                    {!m.enabled && (
                      <Badge variant="outline" className="shrink-0 text-muted-foreground">معطّل</Badge>
                    )}
                  </div>
                  <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )
            })}
            {metals.length === 0 && (
              <div className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                لا توجد معادن بعد
              </div>
            )}
          </nav>
        </Card>
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
    </div>
  )
}


export function MetalEditorDialog({
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