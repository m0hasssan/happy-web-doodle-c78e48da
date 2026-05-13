import { useEffect, useMemo, useState, useCallback } from "react"
import { Recycle, Plus, RotateCcw, History, TrendingDown, TrendingUp, ListTree, Trash2, Zap } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { formatWeight } from "@/lib/number-format"
import { useActiveShift } from "@/hooks/use-active-shift"
import { useAuth } from "@/contexts/auth-context"
import { usePermissions } from "@/hooks/use-permissions"
import { CategoryCascade } from "@/components/category-cascade"
import { type CategoryNode, categoryRequiresCount } from "@/lib/category-tree"

type Section = { id: string; name: string }
type Vault = { id: string; name: string }
type Metal = { id: string; name_ar: string }

type OperationRow = {
  id: string
  code: string
  status: "open" | "closed"
  opened_by_name: string | null
  closed_by_name: string | null
  closed_at: string | null
  created_at: string
}

type OperationSection = {
  id: string
  operation_id: string
  section_id: string
  metal_id: string
  initial_loss_999: number
  recovered_999: number
  waste_999: number
}

type EntryRow = {
  id: string
  operation_id: string
  section_id: string
  metal_id: string
  weight_999: number
  to_vault_id: string | null
  employee_name: string | null
  created_at: string
  is_waste: boolean
}

type SectionLoss = {
  section_id: string
  metal_id: string
  amount: number
}

export default function RecoveryPage() {
  const { shift } = useActiveShift()
  const { displayName } = useAuth()
  const { hasPermission } = usePermissions()
  const canManage = hasPermission("manage_recovery")

  const [loading, setLoading] = useState(true)
  const [sections, setSections] = useState<Section[]>([])
  const [vaults, setVaults] = useState<Vault[]>([])
  const [metals, setMetals] = useState<Metal[]>([])
  const [operations, setOperations] = useState<OperationRow[]>([])
  const [opSections, setOpSections] = useState<OperationSection[]>([])
  const [entries, setEntries] = useState<EntryRow[]>([])
  // Available 999 loss in each section (after subtracting any open operation reservations)
  const [availableLosses, setAvailableLosses] = useState<SectionLoss[]>([])

  const [openDialog, setOpenDialog] = useState(false)
  const [quickDialog, setQuickDialog] = useState(false)
  const [entryDialog, setEntryDialog] = useState<{ op: OperationRow } | null>(null)
  const [closeDialog, setCloseDialog] = useState<{ op: OperationRow } | null>(null)
  const [historyDialog, setHistoryDialog] = useState<{ section: Section } | null>(null)
  const [opDetailsDialog, setOpDetailsDialog] = useState<OperationRow | null>(null)

  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections])
  const metalMap = useMemo(() => new Map(metals.map((m) => [m.id, m.name_ar])), [metals])
  const vaultMap = useMemo(() => new Map(vaults.map((v) => [v.id, v.name])), [vaults])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [secRes, vaultRes, metalRes, opsRes, opSecRes, entriesRes, invRes] = await Promise.all([
        supabase.from("manufacturing_sections").select("id,name").eq("status", "active"),
        supabase.from("vaults").select("id,name").eq("status", "active"),
        supabase.from("metals").select("id,name_ar"),
        supabase.from("recovery_operations").select("*").order("created_at", { ascending: false }),
        supabase.from("recovery_operation_sections").select("*"),
        supabase.from("recovery_entries").select("*").order("created_at", { ascending: false }),
        supabase
          .from("section_shrinkage_inventory")
          .select("section_id,metal_id,total_weight"),
      ])
      setSections((secRes.data ?? []) as Section[])
      setVaults((vaultRes.data ?? []) as Vault[])
      setMetals((metalRes.data ?? []) as Metal[])
      const ops = (opsRes.data ?? []) as OperationRow[]
      const opSecs = (opSecRes.data ?? []) as OperationSection[]
      setOperations(ops)
      setOpSections(opSecs)
      setEntries((entriesRes.data ?? []) as EntryRow[])

      // available = inventory_999 - sum(initial - recovered - waste) over OPEN ops
      const openOpIds = new Set(ops.filter((o) => o.status === "open").map((o) => o.id))
      const reservedKey = new Map<string, number>()
      for (const r of opSecs) {
        if (!openOpIds.has(r.operation_id)) continue
        const k = `${r.section_id}__${r.metal_id}`
        const remaining = Number(r.initial_loss_999) - Number(r.recovered_999) - Number(r.waste_999)
        reservedKey.set(k, (reservedKey.get(k) ?? 0) + remaining)
      }
      const losses: SectionLoss[] = []
      for (const inv of (invRes.data ?? []) as { section_id: string; metal_id: string; total_weight: number }[]) {
        const k = `${inv.section_id}__${inv.metal_id}`
        const avail = Number(inv.total_weight) - (reservedKey.get(k) ?? 0)
        if (avail > 0.0001) {
          losses.push({ section_id: inv.section_id, metal_id: inv.metal_id, amount: avail })
        }
      }
      setAvailableLosses(losses)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const totalAvailableLoss = availableLosses.reduce((s, x) => s + x.amount, 0)
  const totalRecoveredAll = useMemo(
    () => opSections.reduce((s, r) => s + Number(r.recovered_999), 0),
    [opSections],
  )
  const totalWasteAll = useMemo(
    () => opSections.reduce((s, r) => s + Number(r.waste_999), 0),
    [opSections],
  )
  const openOperations = operations.filter((o) => o.status === "open")

  // Build per-section stats for the "losses" tab
  const sectionStats = useMemo(() => {
    type Stat = { section_id: string; total_loss: number; total_recovered: number; total_waste: number }
    const map = new Map<string, Stat>()
    for (const s of sections) {
      map.set(s.id, { section_id: s.id, total_loss: 0, total_recovered: 0, total_waste: 0 })
    }
    // Available current loss
    for (const l of availableLosses) {
      const s = map.get(l.section_id)
      if (s) s.total_loss += l.amount
    }
    // Historical recovered + waste (from all closed/open operations)
    for (const r of opSections) {
      const s = map.get(r.section_id)
      if (!s) continue
      s.total_recovered += Number(r.recovered_999)
      s.total_waste += Number(r.waste_999)
      // Also count "remaining" in open ops as part of current loss too:
      const op = operations.find((o) => o.id === r.operation_id)
      if (op?.status === "open") {
        const remaining = Number(r.initial_loss_999) - Number(r.recovered_999) - Number(r.waste_999)
        if (remaining > 0) s.total_loss += remaining
      }
    }
    return Array.from(map.values())
  }, [sections, availableLosses, opSections, operations])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الخسيات والاسترداد"
        description="عرض إجمالي خسيات الأقسام بعيار 999 وإدارة عمليات الاسترداد"
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setQuickDialog(true)}>
                <Zap className="h-4 w-4" />
                استرداد سريع
              </Button>
              <Button size="sm" onClick={() => setOpenDialog(true)}>
                <Plus className="h-4 w-4" />
                فتح عملية استرداد جديدة
              </Button>
            </div>
          ) : null
        }
      />

      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Recycle className="h-5 w-5 text-warning" />
              إجمالي الخسيات الحالية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{formatWeight(totalAvailableLoss)} جم</div>
            <p className="mt-1 text-xs text-muted-foreground">
              المتاح حالياً في كل الأقسام بعد طرح المحجوز في العمليات المفتوحة
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              إجمالي الخسيات المستردة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{formatWeight(totalRecoveredAll)} جم</div>
            <p className="mt-1 text-xs text-muted-foreground">
              مجموع تراكمي لكل ما تم استرداده على مدار الزمن
            </p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-5 w-5 text-destructive" />
              إجمالي الهالك
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{formatWeight(totalWasteAll)} جم</div>
            <p className="mt-1 text-xs text-muted-foreground">
              مجموع تراكمي للهالك من كل عمليات الاسترداد المنتهية
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Open operations */}
      {openOperations.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">العمليات المفتوحة</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {openOperations.map((op) => (
              <OperationCard
                key={op.id}
                op={op}
                opSections={opSections.filter((r) => r.operation_id === op.id)}
                sectionMap={sectionMap}
                metalMap={metalMap}
                onAddEntry={() => setEntryDialog({ op })}
                onClose={() => setCloseDialog({ op })}
                canManage={canManage}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="losses" className="w-full">
        <TabsList>
          <TabsTrigger value="losses">الخسيات</TabsTrigger>
          <TabsTrigger value="recoveries">الاستردادات</TabsTrigger>
        </TabsList>
        <TabsContent value="losses">
          <LossesTable
            rows={sectionStats.map((s) => ({
              ...s,
              section_name: sections.find((x) => x.id === s.section_id)?.name ?? "-",
            }))}
            loading={loading}
            onRefresh={refresh}
            onShowHistory={(sectionId) => {
              const sec = sections.find((x) => x.id === sectionId)
              if (sec) setHistoryDialog({ section: sec })
            }}
          />
        </TabsContent>
        <TabsContent value="recoveries">
          <RecoveriesTable
            operations={operations}
            opSections={opSections}
            loading={loading}
            onRefresh={refresh}
            onShowDetails={(op) => setOpDetailsDialog(op)}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {openDialog && (
        <OpenOperationDialog
          sections={sections}
          availableLosses={availableLosses}
          shiftId={shift?.id ?? null}
          employeeName={displayName ?? null}
          onClose={() => setOpenDialog(false)}
          onDone={() => {
            setOpenDialog(false)
            refresh()
          }}
        />
      )}

      {quickDialog && (
        <QuickRecoveryDialog
          sections={sections}
          metals={metals}
          vaults={vaults}
          availableLosses={availableLosses}
          shiftId={shift?.id ?? null}
          employeeName={displayName ?? null}
          onClose={() => setQuickDialog(false)}
          onDone={() => {
            setQuickDialog(false)
            refresh()
          }}
        />
      )}

      {entryDialog && (
        <AddEntryDialog
          op={entryDialog.op}
          opSections={opSections.filter((r) => r.operation_id === entryDialog.op.id)}
          sectionMap={sectionMap}
          metalMap={metalMap}
          vaults={vaults}
          shiftId={shift?.id ?? null}
          employeeName={displayName ?? null}
          onClose={() => setEntryDialog(null)}
          onDone={() => {
            setEntryDialog(null)
            refresh()
          }}
        />
      )}

      {closeDialog && (
        <CloseOperationDialog
          op={closeDialog.op}
          opSections={opSections.filter((r) => r.operation_id === closeDialog.op.id)}
          sectionMap={sectionMap}
          metalMap={metalMap}
          shiftId={shift?.id ?? null}
          employeeName={displayName ?? null}
          onClose={() => setCloseDialog(null)}
          onDone={() => {
            setCloseDialog(null)
            refresh()
          }}
        />
      )}

      {historyDialog && (
        <SectionHistoryDialog
          section={historyDialog.section}
          opSections={opSections.filter((r) => r.section_id === historyDialog.section.id)}
          operations={operations}
          entries={entries.filter((e) => e.section_id === historyDialog.section.id)}
          metalMap={metalMap}
          vaultMap={vaultMap}
          onClose={() => setHistoryDialog(null)}
        />
      )}

      {opDetailsDialog && (
        <OperationDetailsDialog
          op={opDetailsDialog}
          opSections={opSections.filter((r) => r.operation_id === opDetailsDialog.id)}
          entries={entries.filter((e) => e.operation_id === opDetailsDialog.id)}
          sectionMap={sectionMap}
          metalMap={metalMap}
          vaultMap={vaultMap}
          onClose={() => setOpDetailsDialog(null)}
        />
      )}
    </div>
  )
}

function OperationCard({
  op,
  opSections,
  sectionMap,
  metalMap,
  onAddEntry,
  onClose,
  canManage,
}: {
  op: OperationRow
  opSections: OperationSection[]
  sectionMap: Map<string, string>
  metalMap: Map<string, string>
  onAddEntry: () => void
  onClose: () => void
  canManage: boolean
}) {
  const totalLoss = opSections.reduce((s, r) => s + Number(r.initial_loss_999), 0)
  const totalRecovered = opSections.reduce((s, r) => s + Number(r.recovered_999), 0)
  const remaining = totalLoss - totalRecovered
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">{op.code}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(op.created_at).toLocaleString("ar-EG")}
            </span>
          </div>
          <Badge variant="secondary">مفتوحة</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-warning/10 p-2">
            <div className="text-xs text-muted-foreground">إجمالي الخسية</div>
            <div className="font-semibold text-warning">{formatWeight(totalLoss)}</div>
          </div>
          <div className="rounded-md bg-emerald-500/10 p-2">
            <div className="text-xs text-muted-foreground">إجمالي المسترد</div>
            <div className="font-semibold text-emerald-600">{formatWeight(totalRecovered)}</div>
          </div>
          <div className="rounded-md bg-muted p-2">
            <div className="text-xs text-muted-foreground">المتبقي</div>
            <div className="font-semibold">{formatWeight(remaining)}</div>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">الأقسام:</div>
          {opSections.map((r) => {
            const rem = Number(r.initial_loss_999) - Number(r.recovered_999)
            return (
              <div key={r.id} className="flex items-center justify-between">
                <span>
                  {sectionMap.get(r.section_id) ?? "-"} ({metalMap.get(r.metal_id) ?? "-"})
                </span>
                <span>
                  {formatWeight(Number(r.recovered_999))} / {formatWeight(Number(r.initial_loss_999))}
                  {rem > 0.0001 && (
                    <span className="ms-1 text-warning">(متبقي {formatWeight(rem)})</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1" onClick={onAddEntry}>
              <Plus className="h-4 w-4" />
              إدخال استرداد
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={onClose}>
              <RotateCcw className="h-4 w-4" />
              إنهاء العملية
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OpenOperationDialog({
  sections,
  availableLosses,
  shiftId,
  employeeName,
  onClose,
  onDone,
}: {
  sections: Section[]
  availableLosses: SectionLoss[]
  shiftId: string | null
  employeeName: string | null
  onClose: () => void
  onDone: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Sections with available loss
  const sectionLossMap = useMemo(() => {
    const m = new Map<string, { totals: number; perMetal: { metal_id: string; amount: number }[] }>()
    for (const l of availableLosses) {
      const cur = m.get(l.section_id) ?? { totals: 0, perMetal: [] }
      cur.totals += l.amount
      cur.perMetal.push({ metal_id: l.metal_id, amount: l.amount })
      m.set(l.section_id, cur)
    }
    return m
  }, [availableLosses])

  const eligibleSections = sections.filter((s) => sectionLossMap.has(s.id))

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleSave = async () => {
    if (selected.size === 0) {
      toast.error("اختر قسم على الأقل")
      return
    }
    if (!shiftId) {
      toast.error("لا يوجد شيفت مفتوح")
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc("recovery_open", {
        p_section_ids: Array.from(selected),
        p_shift_id: shiftId ?? "",
        p_employee_name: employeeName ?? "",
      })
      if (error) throw error
      toast.success("تم فتح عملية الاسترداد")
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>فتح عملية استرداد جديدة</DialogTitle>
          <DialogDescription>اختر الأقسام التي تحتوي على خسيات لنقلها لعملية الاسترداد</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {eligibleSections.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">لا توجد أقسام بها خسيات متاحة</div>
          ) : (
            eligibleSections.map((s) => {
              const info = sectionLossMap.get(s.id)!
              return (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center justify-between rounded-md border p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                    <span className="font-medium">{s.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    (خسية: {formatWeight(info.totals)} جم 999)
                  </span>
                </label>
              )
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving || selected.size === 0}>
            {saving ? "جاري الفتح..." : "فتح العملية"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddEntryDialog({
  op,
  opSections,
  sectionMap,
  metalMap,
  vaults,
  shiftId,
  employeeName,
  onClose,
  onDone,
}: {
  op: OperationRow
  opSections: OperationSection[]
  sectionMap: Map<string, string>
  metalMap: Map<string, string>
  vaults: Vault[]
  shiftId: string | null
  employeeName: string | null
  onClose: () => void
  onDone: () => void
}) {
  const eligibleAll = opSections.filter(
    (r) => Number(r.initial_loss_999) - Number(r.recovered_999) > 0.0001,
  )
  const sectionIds = Array.from(new Set(eligibleAll.map((r) => r.section_id)))

  const [vaultId, setVaultId] = useState<string>(vaults[0]?.id ?? "")
  const [sectionId, setSectionId] = useState<string>(sectionIds[0] ?? "")
  const [saving, setSaving] = useState(false)
  const [karats, setKarats] = useState<{ metal_id: string; karat: string }[]>([])
  const [categories, setCategories] = useState<CategoryNode[]>([])

  const eligible = eligibleAll.filter((r) => r.section_id === sectionId)
  const eligibleMetalIds = useMemo(
    () => new Set(eligible.map((r) => r.metal_id)),
    [eligible],
  )

  type RowEntry = {
    key: string
    metalId: string
    karat: string
    categoryId: string
    weight: string
    count: string
  }
  const newRow = (): RowEntry => ({
    key: crypto.randomUUID(),
    metalId: "",
    karat: "",
    categoryId: "",
    weight: "",
    count: "",
  })
  const [entries, setEntries] = useState<RowEntry[]>([newRow()])

  useEffect(() => {
    supabase
      .from("metal_karats")
      .select("metal_id,karat")
      .then(({ data }) => setKarats((data ?? []) as { metal_id: string; karat: string }[]))
    supabase
      .from("metal_categories")
      .select("id,metal_id,name,requires_count,parent_id,sort_order")
      .order("name")
      .then(({ data }) => setCategories((data ?? []) as CategoryNode[]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset rows when section changes
  useEffect(() => {
    setEntries([newRow()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId])

  const updateEntry = (key: string, patch: Partial<RowEntry>) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.key !== key) return e
        const next = { ...e, ...patch }
        if (patch.metalId !== undefined && patch.metalId !== e.metalId) {
          next.karat = ""
          next.categoryId = ""
          next.count = ""
        }
        if (patch.categoryId !== undefined && patch.categoryId !== e.categoryId) {
          next.count = ""
        }
        return next
      }),
    )
  }
  const addRow = () => setEntries((prev) => [...prev, newRow()])
  const removeRow = (key: string) =>
    setEntries((prev) => (prev.length === 1 ? prev : prev.filter((e) => e.key !== key)))

  const pure999For = (karat: string, weight: string) => {
    const w = Number(weight)
    const k = Number(karat)
    if (!w || !k || w <= 0 || k <= 0) return 0
    return (w * k) / 999
  }
  const sumPureByMetal = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) {
      if (!e.metalId) continue
      m.set(e.metalId, (m.get(e.metalId) ?? 0) + pure999For(e.karat, e.weight))
    }
    return m
  }, [entries])

  const handleSave = async () => {
    if (!vaultId) return toast.error("اختر الخزنة الوجهة")
    if (!sectionId) return toast.error("اختر القسم")
    if (!shiftId) return toast.error("لا يوجد شيفت مفتوح")
    if (entries.length === 0) return toast.error("أضف سطراً واحداً على الأقل")

    type Prepared = {
      metalId: string
      karat: string
      weight: number
      categoryId: string | null
      count: number | null
    }
    const prepared: Prepared[] = []
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const idx = i + 1
      if (!e.metalId) return toast.error(`السطر ${idx}: اختر نوع المعدن`)
      if (!eligibleMetalIds.has(e.metalId))
        return toast.error(`السطر ${idx}: هذا المعدن غير مدرج بعملية الاسترداد لهذا القسم`)
      if (!e.karat.trim()) return toast.error(`السطر ${idx}: اختر العيار`)
      const metalCats = categories.filter((c) => c.metal_id === e.metalId)
      if (metalCats.length > 0 && !e.categoryId)
        return toast.error(`السطر ${idx}: اختر التصنيف`)
      if (e.categoryId) {
        const hasChildren = categories.some((c) => c.parent_id === e.categoryId)
        if (hasChildren) return toast.error(`السطر ${idx}: اختر تصنيف فرعي`)
      }
      const w = Number(e.weight)
      if (!w || w <= 0) return toast.error(`السطر ${idx}: ادخل وزناً صحيحاً`)
      let countValue: number | null = null
      if (e.categoryId && categoryRequiresCount(e.categoryId, categories)) {
        const c = Number(e.count)
        if (!c || c <= 0 || !Number.isInteger(c))
          return toast.error(`السطر ${idx}: ادخل عدداً صحيحاً`)
        countValue = c
      }
      prepared.push({
        metalId: e.metalId,
        karat: e.karat.trim(),
        weight: w,
        categoryId: e.categoryId || null,
        count: countValue,
      })
    }

    // Sum check vs remaining per metal in this section
    for (const ros of eligible) {
      const sum = sumPureByMetal.get(ros.metal_id) ?? 0
      const remaining = Number(ros.initial_loss_999) - Number(ros.recovered_999)
      if (sum > remaining + 0.0001) {
        return toast.error(
          `${metalMap.get(ros.metal_id)}: مجموع المعادل بعيار 999 (${formatWeight(sum)}) أكبر من الخسية المتبقية (${formatWeight(remaining)})`,
        )
      }
    }

    setSaving(true)
    try {
      for (const p of prepared) {
        const { error } = await supabase.rpc("recovery_add_entry_v2", {
          p_operation_id: op.id,
          p_section_id: sectionId,
          p_metal_id: p.metalId,
          p_karat: p.karat,
          p_weight: p.weight,
          p_to_vault_id: vaultId,
          p_shift_id: shiftId ?? "",
          p_employee_name: employeeName ?? "",
          p_category_id: p.categoryId,
          p_count: p.count,
        })
        if (error) throw error
      }
      toast.success("تم إدخال الاسترداد")
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>إدخال استرداد ({op.code})</DialogTitle>
          <DialogDescription>
            سجّل وزن المسترد بأي عيار، وسيُحوَّل إلى المعادل بعيار 999 ويُخصم من الخسية المتبقية.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>الخزنة الوجهة</Label>
              <Select value={vaultId} onValueChange={setVaultId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر خزنة" />
                </SelectTrigger>
                <SelectContent>
                  {vaults.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>القسم</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {sectionIds.map((sid) => (
                    <SelectItem key={sid} value={sid}>
                      {sectionMap.get(sid) ?? "-"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Remaining summary for the selected section */}
          <div className="rounded-md border bg-muted/30 p-2 text-xs">
            <div className="mb-1 font-medium">الخسيات المتبقية في القسم:</div>
            {eligible.length === 0 ? (
              <div className="text-muted-foreground">لا توجد خسيات متبقية</div>
            ) : (
              eligible.map((ros) => {
                const used = sumPureByMetal.get(ros.metal_id) ?? 0
                const remaining = Number(ros.initial_loss_999) - Number(ros.recovered_999)
                const after = remaining - used
                return (
                  <div key={ros.id} className="flex items-center justify-between">
                    <span>{metalMap.get(ros.metal_id)}</span>
                    <span className={after < -0.0001 ? "text-destructive" : "text-muted-foreground"}>
                      {formatWeight(after)} / {formatWeight(remaining)} جم 999
                    </span>
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label>أصناف الاسترداد</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addRow}>
              <Plus className="h-4 w-4" />
              إضافة سطر
            </Button>
          </div>

          <div className="scrollbar-thin flex max-h-[55vh] flex-col gap-3 overflow-y-auto overflow-x-auto pe-2">
            {entries.map((e, idx) => {
              const requiresCount =
                !!e.categoryId && categoryRequiresCount(e.categoryId, categories)
              const pure = pure999For(e.karat, e.weight)
              const eligibleMetalsList = eligible
                .map((r) => ({ id: r.metal_id, name: metalMap.get(r.metal_id) ?? "-" }))
              return (
                <div
                  key={e.key}
                  className="flex w-max min-w-full flex-col gap-2 rounded-md border bg-muted/30 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">سطر {idx + 1}</span>
                    {pure > 0 && (
                      <span className="text-xs text-emerald-600">
                        المعادل: {formatWeight(pure)} جم 999
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex w-40 flex-col gap-1.5">
                      <Label className="text-xs">نوع المعدن</Label>
                      <SearchableSelect
                        value={e.metalId}
                        onValueChange={(v) => updateEntry(e.key, { metalId: v })}
                        placeholder="المعدن"
                        options={eligibleMetalsList.map((m) => ({
                          value: m.id,
                          label: m.name,
                          search: m.name,
                        }))}
                      />
                    </div>
                    <div className="flex w-24 flex-col gap-1.5">
                      <Label className="text-xs">العيار</Label>
                      <SearchableSelect
                        value={e.karat}
                        onValueChange={(v) => updateEntry(e.key, { karat: v })}
                        placeholder="العيار"
                        options={karats
                          .filter((k) => k.metal_id === e.metalId)
                          .map((k) => ({
                            value: k.karat,
                            label: k.karat,
                            search: k.karat,
                            dir: "ltr" as const,
                          }))}
                      />
                    </div>
                    {e.metalId && (
                      <CategoryCascade
                        metalId={e.metalId}
                        categories={categories}
                        value={e.categoryId}
                        onChange={(v) => updateEntry(e.key, { categoryId: v })}
                      />
                    )}
                    <div className="flex w-28 flex-col gap-1.5">
                      <Label className="text-xs">الوزن (جم)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={e.weight}
                        onChange={(ev) => updateEntry(e.key, { weight: ev.target.value })}
                        placeholder="0.000"
                        dir="ltr"
                      />
                    </div>
                    {requiresCount && (
                      <div className="flex w-20 flex-col gap-1.5">
                        <Label className="text-xs">العدد</Label>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          value={e.count}
                          onChange={(ev) => updateEntry(e.key, { count: ev.target.value })}
                          placeholder="—"
                          dir="ltr"
                        />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeRow(e.key)}
                      disabled={entries.length === 1}
                      aria-label="حذف السطر"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function QuickRecoveryDialog({
  sections,
  metals,
  vaults,
  availableLosses,
  shiftId,
  employeeName,
  onClose,
  onDone,
}: {
  sections: Section[]
  metals: Metal[]
  vaults: Vault[]
  availableLosses: SectionLoss[]
  shiftId: string | null
  employeeName: string | null
  onClose: () => void
  onDone: () => void
}) {
  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections])
  const metalMap = useMemo(() => new Map(metals.map((m) => [m.id, m.name_ar])), [metals])

  const sectionIds = useMemo(
    () =>
      Array.from(
        new Set(
          availableLosses.filter((r) => Number(r.amount) > 0.0001).map((r) => r.section_id),
        ),
      ),
    [availableLosses],
  )

  const [vaultId, setVaultId] = useState<string>(vaults[0]?.id ?? "")
  const [sectionId, setSectionId] = useState<string>(sectionIds[0] ?? "")
  const [saving, setSaving] = useState(false)
  const [karats, setKarats] = useState<{ metal_id: string; karat: string }[]>([])
  const [categories, setCategories] = useState<CategoryNode[]>([])

  const eligible = useMemo(
    () =>
      availableLosses.filter(
        (r) => r.section_id === sectionId && Number(r.amount) > 0.0001,
      ),
    [availableLosses, sectionId],
  )
  const eligibleMetalIds = useMemo(
    () => new Set(eligible.map((r) => r.metal_id)),
    [eligible],
  )

  type RowEntry = {
    key: string
    metalId: string
    karat: string
    categoryId: string
    weight: string
    count: string
  }
  const newRow = (): RowEntry => ({
    key: crypto.randomUUID(),
    metalId: "",
    karat: "",
    categoryId: "",
    weight: "",
    count: "",
  })
  const [entries, setEntries] = useState<RowEntry[]>([newRow()])

  useEffect(() => {
    supabase
      .from("metal_karats")
      .select("metal_id,karat")
      .then(({ data }) => setKarats((data ?? []) as { metal_id: string; karat: string }[]))
    supabase
      .from("metal_categories")
      .select("id,metal_id,name,requires_count,parent_id,sort_order")
      .order("name")
      .then(({ data }) => setCategories((data ?? []) as CategoryNode[]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setEntries([newRow()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId])

  const updateEntry = (key: string, patch: Partial<RowEntry>) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.key !== key) return e
        const next = { ...e, ...patch }
        if (patch.metalId !== undefined && patch.metalId !== e.metalId) {
          next.karat = ""
          next.categoryId = ""
          next.count = ""
        }
        if (patch.categoryId !== undefined && patch.categoryId !== e.categoryId) {
          next.count = ""
        }
        return next
      }),
    )
  }
  const addRow = () => setEntries((prev) => [...prev, newRow()])
  const removeRow = (key: string) =>
    setEntries((prev) => (prev.length === 1 ? prev : prev.filter((e) => e.key !== key)))

  const pure999For = (karat: string, weight: string) => {
    const w = Number(weight)
    const k = Number(karat)
    if (!w || !k || w <= 0 || k <= 0) return 0
    return (w * k) / 999
  }
  const sumPureByMetal = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) {
      if (!e.metalId) continue
      m.set(e.metalId, (m.get(e.metalId) ?? 0) + pure999For(e.karat, e.weight))
    }
    return m
  }, [entries])

  const handleSave = async () => {
    if (!vaultId) return toast.error("اختر الخزنة الوجهة")
    if (!sectionId) return toast.error("اختر القسم")
    if (!shiftId) return toast.error("لا يوجد شيفت مفتوح")
    if (entries.length === 0) return toast.error("أضف سطراً واحداً على الأقل")

    type Prepared = {
      metalId: string
      karat: string
      weight: number
      categoryId: string | null
      count: number | null
    }
    const prepared: Prepared[] = []
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const idx = i + 1
      if (!e.metalId) return toast.error(`السطر ${idx}: اختر نوع المعدن`)
      if (!eligibleMetalIds.has(e.metalId))
        return toast.error(`السطر ${idx}: لا توجد خسية متاحة لهذا المعدن في القسم`)
      if (!e.karat.trim()) return toast.error(`السطر ${idx}: اختر العيار`)
      const metalCats = categories.filter((c) => c.metal_id === e.metalId)
      if (metalCats.length > 0 && !e.categoryId)
        return toast.error(`السطر ${idx}: اختر التصنيف`)
      if (e.categoryId) {
        const hasChildren = categories.some((c) => c.parent_id === e.categoryId)
        if (hasChildren) return toast.error(`السطر ${idx}: اختر تصنيف فرعي`)
      }
      const w = Number(e.weight)
      if (!w || w <= 0) return toast.error(`السطر ${idx}: ادخل وزناً صحيحاً`)
      let countValue: number | null = null
      if (e.categoryId && categoryRequiresCount(e.categoryId, categories)) {
        const c = Number(e.count)
        if (!c || c <= 0 || !Number.isInteger(c))
          return toast.error(`السطر ${idx}: ادخل عدداً صحيحاً`)
        countValue = c
      }
      prepared.push({
        metalId: e.metalId,
        karat: e.karat.trim(),
        weight: w,
        categoryId: e.categoryId || null,
        count: countValue,
      })
    }

    for (const ros of eligible) {
      const sum = sumPureByMetal.get(ros.metal_id) ?? 0
      const remaining = Number(ros.amount)
      if (sum > remaining + 0.0001) {
        return toast.error(
          `${metalMap.get(ros.metal_id)}: مجموع المعادل بعيار 999 (${formatWeight(sum)}) أكبر من الخسية المتاحة (${formatWeight(remaining)})`,
        )
      }
    }

    setSaving(true)
    try {
      for (const p of prepared) {
        const { error } = await supabase.rpc("recovery_quick_entry", {
          p_section_id: sectionId,
          p_metal_id: p.metalId,
          p_karat: p.karat,
          p_weight: p.weight,
          p_to_vault_id: vaultId,
          p_shift_id: shiftId ?? "",
          p_employee_name: employeeName ?? "",
          p_category_id: p.categoryId ?? undefined,
          p_count: p.count ?? undefined,
        })
        if (error) throw error
      }
      toast.success("تم تسجيل الاسترداد السريع")
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>استرداد سريع</DialogTitle>
          <DialogDescription>
            سجّل وزناً مسترداً مباشرةً وسيُخصم بمعادل عيار 999 من خسية القسم دون فتح عملية استرداد.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>الخزنة الوجهة</Label>
              <Select value={vaultId} onValueChange={setVaultId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر خزنة" />
                </SelectTrigger>
                <SelectContent>
                  {vaults.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>القسم</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {sectionIds.map((sid) => (
                    <SelectItem key={sid} value={sid}>
                      {sectionMap.get(sid) ?? "-"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-2 text-xs">
            <div className="mb-1 font-medium">الخسيات المتاحة في القسم:</div>
            {eligible.length === 0 ? (
              <div className="text-muted-foreground">لا توجد خسيات متاحة</div>
            ) : (
              eligible.map((ros) => {
                const used = sumPureByMetal.get(ros.metal_id) ?? 0
                const remaining = Number(ros.amount)
                const after = remaining - used
                return (
                  <div key={`${ros.section_id}-${ros.metal_id}`} className="flex items-center justify-between">
                    <span>{metalMap.get(ros.metal_id)}</span>
                    <span className={after < -0.0001 ? "text-destructive" : "text-muted-foreground"}>
                      {formatWeight(after)} / {formatWeight(remaining)} جم 999
                    </span>
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label>أصناف الاسترداد</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addRow}>
              <Plus className="h-4 w-4" />
              إضافة سطر
            </Button>
          </div>

          <div className="scrollbar-thin flex max-h-[55vh] flex-col gap-3 overflow-y-auto overflow-x-auto pe-2">
            {entries.map((e, idx) => {
              const requiresCount =
                !!e.categoryId && categoryRequiresCount(e.categoryId, categories)
              const pure = pure999For(e.karat, e.weight)
              const eligibleMetalsList = eligible.map((r) => ({
                id: r.metal_id,
                name: metalMap.get(r.metal_id) ?? "-",
              }))
              return (
                <div
                  key={e.key}
                  className="flex w-max min-w-full flex-col gap-2 rounded-md border bg-muted/30 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">سطر {idx + 1}</span>
                    {pure > 0 && (
                      <span className="text-xs text-emerald-600">
                        المعادل: {formatWeight(pure)} جم 999
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex w-40 flex-col gap-1.5">
                      <Label className="text-xs">نوع المعدن</Label>
                      <SearchableSelect
                        value={e.metalId}
                        onValueChange={(v) => updateEntry(e.key, { metalId: v })}
                        placeholder="المعدن"
                        options={eligibleMetalsList.map((m) => ({
                          value: m.id,
                          label: m.name,
                          search: m.name,
                        }))}
                      />
                    </div>
                    <div className="flex w-24 flex-col gap-1.5">
                      <Label className="text-xs">العيار</Label>
                      <SearchableSelect
                        value={e.karat}
                        onValueChange={(v) => updateEntry(e.key, { karat: v })}
                        placeholder="العيار"
                        options={karats
                          .filter((k) => k.metal_id === e.metalId)
                          .map((k) => ({
                            value: k.karat,
                            label: k.karat,
                            search: k.karat,
                            dir: "ltr" as const,
                          }))}
                      />
                    </div>
                    {e.metalId && (
                      <CategoryCascade
                        metalId={e.metalId}
                        categories={categories}
                        value={e.categoryId}
                        onChange={(v) => updateEntry(e.key, { categoryId: v })}
                      />
                    )}
                    <div className="flex w-28 flex-col gap-1.5">
                      <Label className="text-xs">الوزن (جم)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={e.weight}
                        onChange={(ev) => updateEntry(e.key, { weight: ev.target.value })}
                        placeholder="0.000"
                        dir="ltr"
                      />
                    </div>
                    {requiresCount && (
                      <div className="flex w-20 flex-col gap-1.5">
                        <Label className="text-xs">العدد</Label>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          value={e.count}
                          onChange={(ev) => updateEntry(e.key, { count: ev.target.value })}
                          placeholder="—"
                          dir="ltr"
                        />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeRow(e.key)}
                      disabled={entries.length === 1}
                      aria-label="حذف السطر"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CloseOperationDialog({
  op,
  opSections,
  sectionMap,
  metalMap,
  shiftId,
  employeeName,
  onClose,
  onDone,
}: {
  op: OperationRow
  opSections: OperationSection[]
  sectionMap: Map<string, string>
  metalMap: Map<string, string>
  shiftId: string | null
  employeeName: string | null
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const totalWaste = opSections.reduce(
    (s, r) => s + Math.max(0, Number(r.initial_loss_999) - Number(r.recovered_999)),
    0,
  )

  const handleClose = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.rpc("recovery_close", {
        p_operation_id: op.id,
        p_shift_id: shiftId ?? "",
        p_employee_name: employeeName ?? "",
      })
      if (error) throw error
      toast.success("تم إنهاء العملية")
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>إنهاء عملية الاسترداد</AlertDialogTitle>
          <AlertDialogDescription>
            عند الإنهاء، أي خسية متبقية ستُسجَّل كهالك ولا يمكن استردادها لاحقاً.
            <br />
            إجمالي الهالك المتوقع: <span className="font-semibold text-destructive">{formatWeight(totalWaste)} جم</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1 text-xs">
          {opSections.map((r) => {
            const w = Math.max(0, Number(r.initial_loss_999) - Number(r.recovered_999))
            return (
              <div key={r.id} className="flex justify-between">
                <span>{sectionMap.get(r.section_id)} ({metalMap.get(r.metal_id)})</span>
                <span className="text-destructive">هالك: {formatWeight(w)}</span>
              </div>
            )
          })}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={handleClose} disabled={saving}>
            {saving ? "جاري الإنهاء..." : "تأكيد الإنهاء"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function SectionHistoryDialog({
  section,
  opSections,
  operations,
  entries,
  metalMap,
  vaultMap,
  onClose,
}: {
  section: Section
  opSections: OperationSection[]
  operations: OperationRow[]
  entries: EntryRow[]
  metalMap: Map<string, string>
  vaultMap: Map<string, string>
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>الاستردادات السابقة - {section.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto">
          {opSections.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">لا توجد سجلات</div>
          ) : (
            <div className="flex flex-col gap-3">
              {opSections.map((r) => {
                const op = operations.find((o) => o.id === r.operation_id)
                if (!op) return null
                const ops = entries.filter((e) => e.operation_id === r.operation_id && e.metal_id === r.metal_id)
                return (
                  <div key={r.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{op.code}</span>
                      <Badge variant={op.status === "open" ? "secondary" : "outline"}>
                        {op.status === "open" ? "مفتوحة" : "منتهية"}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="text-muted-foreground">الخسية</div>
                        <div className="font-semibold">{formatWeight(Number(r.initial_loss_999))}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">المسترد</div>
                        <div className="font-semibold text-emerald-600">
                          {formatWeight(Number(r.recovered_999))}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">الهالك</div>
                        <div className="font-semibold text-destructive">
                          {formatWeight(Number(r.waste_999))}
                        </div>
                      </div>
                    </div>
                    {ops.length > 0 && (
                      <div className="mt-2 border-t pt-2 text-xs">
                        <div className="font-medium">حركات الاسترداد ({metalMap.get(r.metal_id)}):</div>
                        {ops.map((e) => (
                          <div key={e.id} className="flex justify-between text-muted-foreground">
                            <span>{new Date(e.created_at).toLocaleString("ar-EG")}</span>
                            <span>
                              {formatWeight(Number(e.weight_999))} →{" "}
                              {e.is_waste
                                ? "هالك"
                                : e.to_vault_id
                                  ? vaultMap.get(e.to_vault_id)
                                  : "-"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
type LossRow = {
  section_id: string
  section_name: string
  total_loss: number
  total_recovered: number
  total_waste: number
}

function LossesTable({
  rows,
  loading,
  onRefresh,
  onShowHistory,
}: {
  rows: LossRow[]
  loading: boolean
  onRefresh: () => void
  onShowHistory: (sectionId: string) => void
}) {
  const columns: DataTableColumn<LossRow>[] = [
    { key: "section_name", header: "اسم القسم", sortable: true, cell: (r) => <span className="font-medium">{r.section_name}</span> },
    { key: "total_loss", header: "إجمالي الخسيات", sortable: true, cell: (r) => `${formatWeight(r.total_loss)} جم` },
    { key: "total_recovered", header: "إجمالي الاستردادات", sortable: true, cell: (r) => <span className="text-emerald-600">{formatWeight(r.total_recovered)} جم</span> },
    { key: "total_waste", header: "إجمالي الهالك", sortable: true, cell: (r) => <span className="text-destructive">{formatWeight(r.total_waste)} جم</span> },
    {
      key: "actions",
      header: "",
      headerClassName: "text-end",
      className: "text-end",
      cell: (r) => (
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => onShowHistory(r.section_id)}>
          <History className="h-3.5 w-3.5" />
          الاستردادات السابقة
        </Button>
      ),
    },
  ]
  return (
    <DataTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.section_id}
      searchKeys={["section_name"]}
      searchPlaceholder="ابحث باسم القسم..."
      loading={loading}
      onRefresh={onRefresh}
      emptyMessage="لا توجد بيانات"
    />
  )
}

type OpRow = {
  id: string
  code: string
  status: "open" | "closed"
  created_at: string
  closed_at: string | null
  opened_by_name: string | null
  closed_by_name: string | null
  total_loss: number
  total_recovered: number
  total_waste: number
}

function RecoveriesTable({
  operations,
  opSections,
  loading,
  onRefresh,
  onShowDetails,
}: {
  operations: OperationRow[]
  opSections: OperationSection[]
  loading: boolean
  onRefresh: () => void
  onShowDetails: (op: OperationRow) => void
}) {
  const rows: OpRow[] = useMemo(() => {
    return operations.map((op) => {
      const rs = opSections.filter((r) => r.operation_id === op.id)
      const total_loss = rs.reduce((s, r) => s + Number(r.initial_loss_999), 0)
      const total_recovered = rs.reduce((s, r) => s + Number(r.recovered_999), 0)
      const total_waste = rs.reduce((s, r) => s + Number(r.waste_999), 0)
      return {
        id: op.id,
        code: op.code,
        status: op.status,
        created_at: op.created_at,
        closed_at: op.closed_at,
        opened_by_name: op.opened_by_name,
        closed_by_name: op.closed_by_name,
        total_loss,
        total_recovered,
        total_waste,
      }
    })
  }, [operations, opSections])

  const columns: DataTableColumn<OpRow>[] = [
    { key: "code", header: "كود العملية", sortable: true, cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "created_at", header: "تاريخ الفتح", sortable: true, cell: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</span> },
    { key: "status", header: "الحالة", sortable: true, cell: (r) => <Badge variant={r.status === "open" ? "secondary" : "outline"}>{r.status === "open" ? "مفتوحة" : "منتهية"}</Badge> },
    { key: "opened_by_name", header: "فتحت بواسطة", cell: (r) => r.opened_by_name ?? "-" },
    { key: "total_loss", header: "إجمالي الخسية", sortable: true, cell: (r) => `${formatWeight(r.total_loss)} جم` },
    { key: "total_recovered", header: "المسترد", sortable: true, cell: (r) => <span className="text-emerald-600">{formatWeight(r.total_recovered)} جم</span> },
    { key: "total_waste", header: "الهالك", sortable: true, cell: (r) => <span className="text-destructive">{formatWeight(r.total_waste)} جم</span> },
    {
      key: "actions",
      header: "",
      headerClassName: "text-end",
      className: "text-end",
      cell: (r) => {
        const op = operations.find((o) => o.id === r.id)
        if (!op) return null
        return (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => onShowDetails(op)}>
            <ListTree className="h-3.5 w-3.5" />
            تفاصيل العملية
          </Button>
        )
      },
    },
  ]
  return (
    <DataTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchKeys={["code", "opened_by_name"]}
      searchPlaceholder="ابحث بكود العملية أو الموظف..."
      loading={loading}
      onRefresh={onRefresh}
      emptyMessage="لا توجد عمليات استرداد"
    />
  )
}

function OperationDetailsDialog({
  op,
  opSections,
  entries,
  sectionMap,
  metalMap,
  vaultMap,
  onClose,
}: {
  op: OperationRow
  opSections: OperationSection[]
  entries: EntryRow[]
  sectionMap: Map<string, string>
  metalMap: Map<string, string>
  vaultMap: Map<string, string>
  onClose: () => void
}) {
  const totalLoss = opSections.reduce((s, r) => s + Number(r.initial_loss_999), 0)
  const totalRecovered = opSections.reduce((s, r) => s + Number(r.recovered_999), 0)
  const totalWaste = opSections.reduce((s, r) => s + Number(r.waste_999), 0)
  const sorted = [...entries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>تفاصيل العملية - {op.code}</DialogTitle>
          <DialogDescription>
            {op.status === "open" ? "العملية لا تزال مفتوحة" : `أُنهيت بواسطة ${op.closed_by_name ?? "-"}`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md bg-warning/10 p-2">
            <div className="text-muted-foreground">إجمالي الخسية</div>
            <div className="font-semibold text-warning">{formatWeight(totalLoss)} جم</div>
          </div>
          <div className="rounded-md bg-emerald-500/10 p-2">
            <div className="text-muted-foreground">إجمالي المسترد</div>
            <div className="font-semibold text-emerald-600">{formatWeight(totalRecovered)} جم</div>
          </div>
          <div className="rounded-md bg-destructive/10 p-2">
            <div className="text-muted-foreground">إجمالي الهالك</div>
            <div className="font-semibold text-destructive">{formatWeight(totalWaste)} جم</div>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">لا توجد حركات</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>المعدن</TableHead>
                    <TableHead>الوزن</TableHead>
                    <TableHead>الوجهة</TableHead>
                    <TableHead>الموظف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("ar-EG")}</TableCell>
                      <TableCell>
                        {e.is_waste ? (
                          <Badge variant="destructive">هالك</Badge>
                        ) : (
                          <Badge variant="secondary">استرداد</Badge>
                        )}
                      </TableCell>
                      <TableCell>{sectionMap.get(e.section_id) ?? "-"}</TableCell>
                      <TableCell>{metalMap.get(e.metal_id) ?? "-"}</TableCell>
                      <TableCell className={e.is_waste ? "text-destructive" : "text-emerald-600"}>{formatWeight(Number(e.weight_999))} جم</TableCell>
                      <TableCell>
                        {e.is_waste ? "—" : e.to_vault_id ? vaultMap.get(e.to_vault_id) ?? "-" : "-"}
                      </TableCell>
                      <TableCell>{e.employee_name ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
