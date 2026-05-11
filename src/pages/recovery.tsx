import { useEffect, useMemo, useState, useCallback } from "react"
import { Recycle, Plus, RotateCcw, History, ChevronRight } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  to_vault_id: string
  employee_name: string | null
  created_at: string
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
  const [entryDialog, setEntryDialog] = useState<{ op: OperationRow } | null>(null)
  const [closeDialog, setCloseDialog] = useState<{ op: OperationRow } | null>(null)
  const [historyDialog, setHistoryDialog] = useState<{ section: Section } | null>(null)

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
          .from("section_inventory")
          .select("section_id,metal_id,total_weight")
          .eq("karat", "999")
          .is("category_id", null),
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
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="الخسيات والاسترداد"
        description="عرض إجمالي خسيات الأقسام بعيار 999 وإدارة عمليات الاسترداد"
        actions={
          canManage ? (
            <Button onClick={() => setOpenDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              فتح عملية استرداد جديدة
            </Button>
          ) : null
        }
      />

      {/* Summary card */}
      <Card className="border-warning/30 bg-warning/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Recycle className="h-5 w-5 text-warning" />
            إجمالي الخسيات الحالية (عيار 999)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-warning">{formatWeight(totalAvailableLoss)} جم</div>
          <p className="mt-1 text-xs text-muted-foreground">
            مجموع الخسية المتاحة في كل الأقسام بعد طرح المحجوز في العمليات المفتوحة
          </p>
        </CardContent>
      </Card>

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
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم القسم</TableHead>
                    <TableHead>إجمالي الخسيات</TableHead>
                    <TableHead>إجمالي الاستردادات</TableHead>
                    <TableHead>إجمالي الهالك</TableHead>
                    <TableHead className="text-end">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectionStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        {loading ? "جاري التحميل..." : "لا توجد بيانات"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sectionStats.map((s) => {
                      const sec = sections.find((x) => x.id === s.section_id)
                      if (!sec) return null
                      return (
                        <TableRow key={s.section_id}>
                          <TableCell className="font-medium">{sec.name}</TableCell>
                          <TableCell>{formatWeight(s.total_loss)} جم</TableCell>
                          <TableCell className="text-emerald-600">
                            {formatWeight(s.total_recovered)} جم
                          </TableCell>
                          <TableCell className="text-destructive">
                            {formatWeight(s.total_waste)} جم
                          </TableCell>
                          <TableCell className="text-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => setHistoryDialog({ section: sec })}
                            >
                              <History className="h-3.5 w-3.5" />
                              الاستردادات السابقة
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="recoveries">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>اسم القسم</TableHead>
                    <TableHead>المعدن</TableHead>
                    <TableHead>المسترد</TableHead>
                    <TableHead>الخزنة</TableHead>
                    <TableHead>الموظف</TableHead>
                    <TableHead>كود العملية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                        لا توجد استردادات
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((e) => {
                      const op = operations.find((o) => o.id === e.operation_id)
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(e.created_at).toLocaleString("ar-EG")}
                          </TableCell>
                          <TableCell>{sectionMap.get(e.section_id) ?? "-"}</TableCell>
                          <TableCell>{metalMap.get(e.metal_id) ?? "-"}</TableCell>
                          <TableCell className="text-emerald-600">{formatWeight(Number(e.weight_999))} جم</TableCell>
                          <TableCell>{vaultMap.get(e.to_vault_id) ?? "-"}</TableCell>
                          <TableCell>{e.employee_name ?? "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{op?.code ?? "-"}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {openDialog && (
        <OpenOperationDialog
          sections={sections}
          metals={metals}
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
  metals,
  availableLosses,
  shiftId,
  employeeName,
  onClose,
  onDone,
}: {
  sections: Section[]
  metals: Metal[]
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
        p_shift_id: shiftId,
        p_employee_name: employeeName,
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
  const eligible = opSections.filter(
    (r) => Number(r.initial_loss_999) - Number(r.recovered_999) > 0.0001,
  )
  const [rosId, setRosId] = useState<string>(eligible[0]?.id ?? "")
  const [weight, setWeight] = useState<string>("")
  const [vaultId, setVaultId] = useState<string>(vaults[0]?.id ?? "")
  const [saving, setSaving] = useState(false)

  const selected = eligible.find((r) => r.id === rosId)
  const remaining = selected ? Number(selected.initial_loss_999) - Number(selected.recovered_999) : 0

  const handleSave = async () => {
    if (!selected) {
      toast.error("اختر قسم")
      return
    }
    if (!vaultId) {
      toast.error("اختر خزنة")
      return
    }
    const w = parseFloat(weight)
    if (!w || w <= 0) {
      toast.error("ادخل وزن صحيح")
      return
    }
    if (w > remaining + 0.0001) {
      toast.error(`المسترد أكبر من الخسية المتبقية (${formatWeight(remaining)})`)
      return
    }
    if (!shiftId) {
      toast.error("لا يوجد شيفت مفتوح")
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc("recovery_add_entry", {
        p_operation_id: op.id,
        p_section_id: selected.section_id,
        p_metal_id: selected.metal_id,
        p_weight: w,
        p_to_vault_id: vaultId,
        p_shift_id: shiftId,
        p_employee_name: employeeName,
      })
      if (error) throw error
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إدخال استرداد</DialogTitle>
          <DialogDescription>سجّل وزن المسترد من قسم محدد إلى خزنة</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>القسم</Label>
            <Select value={rosId} onValueChange={setRosId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر قسم" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((r) => {
                  const rem = Number(r.initial_loss_999) - Number(r.recovered_999)
                  return (
                    <SelectItem key={r.id} value={r.id}>
                      {sectionMap.get(r.section_id)} - {metalMap.get(r.metal_id)} (متبقي: {formatWeight(rem)})
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>وزن المسترد (عيار 999)</Label>
            <Input
              type="number"
              step="0.001"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={selected ? `حتى ${formatWeight(remaining)}` : ""}
            />
          </div>
          <div className="flex flex-col gap-1">
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
        p_shift_id: shiftId,
        p_employee_name: employeeName,
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
                              {formatWeight(Number(e.weight_999))} → {vaultMap.get(e.to_vault_id)}
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