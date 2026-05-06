import { useEffect, useState } from "react"
import { ChevronLeft, Coins, Database, Download, Upload, Eraser, Trash2, Plus, X } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
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
import { cn } from "@/lib/utils"
import { toast } from "sonner"
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

type Metal = { id: string; code: string; name_ar: string; enabled: boolean; color: string }
type Karat = { id: string; metal_id: string; karat: string }

export function SystemSettingsPage() {
  const [view, setView] = useState<"index" | "metals" | "data">("index")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إعدادات النظام"
        description="ضبط الإعدادات العامة للنظام"
        actions={
          view !== "index" ? (
            <Button variant="outline" className="gap-2" onClick={() => setView("index")}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              رجوع
            </Button>
          ) : null
        }
      />

      {view === "index" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
      )}

      {view === "metals" && <MetalsSettings />}
      {view === "data" && <DataSettings />}
    </div>
  )
}

function MetalsSettings() {
  const [metals, setMetals] = useState<Metal[]>([])
  const [karats, setKarats] = useState<Karat[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Metal | "new" | null>(null)
  const [deleting, setDeleting] = useState<Metal | null>(null)
  const [karatInput, setKaratInput] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    const [m, k] = await Promise.all([
      supabase.from("metals").select("id,code,name_ar,enabled,color").order("name_ar"),
      supabase.from("metal_karats").select("id,metal_id,karat").order("karat"),
    ])
    setMetals((m.data ?? []) as Metal[])
    setKarats((k.data ?? []) as Karat[])
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

  const isUsed = async (metalId: string) => {
    const checks = await Promise.all([
      supabase.from("vault_inventory").select("id", { count: "exact", head: true }).eq("metal_id", metalId),
      supabase.from("section_inventory").select("id", { count: "exact", head: true }).eq("metal_id", metalId),
      supabase.from("movements").select("id", { count: "exact", head: true }).eq("metal_id", metalId),
      supabase.from("vault_metals").select("metal_id", { count: "exact", head: true }).eq("metal_id", metalId),
      supabase.from("section_metals").select("metal_id", { count: "exact", head: true }).eq("metal_id", metalId),
    ])
    return checks.some((c) => (c.count ?? 0) > 0)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    if (await isUsed(deleting.id)) {
      toast.error("لا يمكن حذف معدن مستخدم في النظام")
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" />
          إضافة معدن
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : (
        metals.map((m) => {
          const preset = getMetalPreset(m.color)
          const ks = karats.filter((k) => k.metal_id === m.id)
          return (
            <Card key={m.id}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-6 w-6 rounded-full ring-2 ring-border"
                      style={{ background: preset.swatch }}
                    />
                    <span className={cn("font-medium", preset.text)}>{m.name_ar}</span>
                    <span className="text-xs text-muted-foreground">{preset.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={m.enabled} onCheckedChange={() => toggle(m)} />
                    <Button variant="outline" size="sm" onClick={() => setEditing(m)}>
                      تعديل
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setDeleting(m)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
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
                      className="max-w-[160px]"
                    />
                    <Button size="sm" variant="outline" onClick={() => addKarat(m.id)}>
                      <Plus className="h-4 w-4" />
                      إضافة عيار
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
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
      const tasks = [
        supabase.from("movements").delete().gte("created_at", "1900-01-01"),
        supabase.from("vault_inventory").delete().gte("updated_at", "1900-01-01"),
        supabase.from("section_inventory").delete().gte("updated_at", "1900-01-01"),
        supabase.from("shifts").delete().gte("created_at", "1900-01-01"),
      ]
      for (const t of tasks) {
        const { error } = await t
        if (error) throw error
      }
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
      const tasks = [
        supabase.from("movements").delete().gte("created_at", "1900-01-01"),
        supabase.from("shifts").delete().gte("created_at", "1900-01-01"),
        supabase.from("vault_inventory").delete().gte("updated_at", "1900-01-01"),
        supabase.from("section_inventory").delete().gte("updated_at", "1900-01-01"),
        supabase.from("vault_metals").delete().gte("created_at", "1900-01-01"),
        supabase.from("section_metals").delete().gte("created_at", "1900-01-01"),
        supabase.from("vaults").delete().gte("created_at", "1900-01-01"),
        supabase.from("manufacturing_sections").delete().gte("created_at", "1900-01-01"),
        supabase.from("suppliers").delete().gte("created_at", "1900-01-01"),
      ]
      for (const t of tasks) {
        const { error } = await t
        if (error) throw error
      }
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
            <Button onClick={handleExport} disabled={busy !== null}>
              {busy === "export" ? "جارٍ التحميل..." : "تحميل"}
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
                disabled={busy !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (f) handleImport(f)
                }}
              />
              <Button asChild disabled={busy !== null}>
                <span>{busy === "import" ? "جارٍ الرفع..." : "اختيار ملف"}</span>
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
              disabled={busy !== null}
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
              disabled={busy !== null}
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
              {busy ? "جارٍ التنفيذ..." : "تأكيد"}
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
              {busy === "import" ? "جارٍ الرفع..." : "تأكيد الرفع"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}