import { useEffect, useState } from "react"
import { ChevronLeft, Coins, Database, Download, Upload, Eraser, Trash2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
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

type Metal = { id: string; code: string; name_ar: string; enabled: boolean }

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
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from("metals").select("*").order("name_ar")
    setMetals((data ?? []) as Metal[])
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

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : (
          metals.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Coins className="h-5 w-5 text-primary-strong" />
                <span className="font-medium">{m.name_ar}</span>
              </div>
              <Switch checked={m.enabled} onCheckedChange={() => toggle(m)} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
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

      // Check duplicates by code/id against existing rows
      const checks: { table: string; field: string; values: string[] }[] = [
        { table: "vaults", field: "id", values: (data.vaults ?? []).map((x) => x.id) },
        { table: "manufacturing_sections", field: "id", values: (data.manufacturing_sections ?? []).map((x) => x.id) },
        { table: "suppliers", field: "id", values: (data.suppliers ?? []).map((x) => x.id) },
        { table: "movements", field: "code", values: (data.movements ?? []).map((x) => x.code) },
        { table: "shifts", field: "code", values: (data.shifts ?? []).map((x) => x.code) },
      ]
      for (const c of checks) {
        if (!c.values.length) continue
        const { data: existing, error } = await supabase
          .from(c.table as any)
          .select(c.field)
          .in(c.field, c.values)
        if (error) throw error
        if ((existing ?? []).length > 0) {
          const dup = (existing as any[]).map((x) => x[c.field]).slice(0, 5).join(", ")
          throw new Error(`يوجد كود مكرر في ${c.table}: ${dup}`)
        }
      }

      // Insert in dependency order
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
      for (const t of order) {
        const rows = (data[t] as any[]) ?? []
        if (!rows.length) continue
        const { error } = await supabase.from(t as any).insert(rows)
        if (error) throw error
      }
      toast.success("تم رفع البيانات بنجاح")
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
    </>
  )
}