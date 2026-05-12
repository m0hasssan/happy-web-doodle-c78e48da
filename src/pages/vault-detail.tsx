import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Vault as VaultIcon, Plus, Check, ChevronsUpDown, Trash2, Minus, Hash } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { metalClasses } from "@/lib/metal-colors"
import { StatGridSkeleton } from "@/components/loading-skeletons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DataTable } from "@/components/data-table"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"
import { fetchWorkOrders, workOrderColumns, type WorkOrderRow } from "./work-orders"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WorkOrderCard } from "@/components/work-order-card"
import { useActiveShift } from "@/hooks/use-active-shift"
import { usePermissions } from "@/hooks/use-permissions"
import { computeWorkOrderContents } from "@/lib/work-order-contents"
import { Card as PermCard, CardContent as PermCardContent } from "@/components/ui/card"
import { Lock } from "lucide-react"
import { formatWeight } from "@/lib/number-format"
import { type CategoryNode, categoryRequiresCount } from "@/lib/category-tree"
import { CategoryCascade } from "@/components/category-cascade"

type Vault = { id: string; name: string; status: string }
type Metal = { id: string; code: string; name_ar: string; color: string }
type InvRow = { metal_id: string; total_weight: number; karat: string | null; category_id: string | null; total_count: number | null }
type Supplier = { id: string; name: string }
type Category = CategoryNode

export function VaultDetailPage() {
  const { vaultId } = useParams<{ vaultId: string }>()
  const { hasPermission, loading: permLoading } = usePermissions()
  const [vault, setVault] = useState<Vault | null>(null)
  const [metals, setMetals] = useState<Metal[]>([])
  const [rows, setRows] = useState<InvRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const { shift: activeShift } = useActiveShift()

  const load = async () => {
    if (!vaultId) return
    setLoading(true)
    const [v, m, inv, vm, mv, wo] = await Promise.all([
      supabase.from("vaults").select("id,name,status").eq("id", vaultId).single(),
      supabase.from("metals").select("id,code,name_ar,color"),
      supabase.from("vault_inventory").select("metal_id,total_weight,karat,category_id,total_count").eq("vault_id", vaultId),
      supabase.from("vault_metals").select("metal_id").eq("vault_id", vaultId),
      fetchMovementRows({ vaultId }),
      fetchWorkOrders({ vaultId }),
    ])
    const allowedIds = new Set((vm.data ?? []).map((x) => x.metal_id))
    setVault((v.data ?? null) as Vault | null)
    setMetals(((m.data ?? []) as Metal[]).filter((mm) => allowedIds.has(mm.id)))
    setRows((inv.data ?? []) as InvRow[])
    setMovements(mv)
    setWorkOrders(wo)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultId])

  // breakdown per metal+karat+category from movements (in - out)
  // keyed by category_id so we can match against selected category ids
  type Bd = { weight: number; count: number | null; name: string }
  const breakdownMap = new Map<string, Map<string, Bd>>()
  for (const mv of movements) {
    if (!mv.category_id) continue
    const sign = mv.to_type === "vault" && mv.to_id === vaultId ? 1 : mv.from_type === "vault" && mv.from_id === vaultId ? -1 : 0
    if (!sign) continue
    const key = `${mv.metal_id}__${mv.karat ?? ""}`
    let inner = breakdownMap.get(key)
    if (!inner) { inner = new Map(); breakdownMap.set(key, inner) }
    const cur = inner.get(mv.category_id) ?? { weight: 0, count: null as number | null, name: mv.category_name ?? "" }
    cur.weight += sign * Number(mv.weight)
    if (mv.count != null) cur.count = (cur.count ?? 0) + sign * Number(mv.count)
    if (mv.category_name && !cur.name) cur.name = mv.category_name
    inner.set(mv.category_id, cur)
  }

  // Reserved-for-work-orders: weights currently held at this vault belonging
  // to in-progress work orders (i.e. temporarily returned). These are NOT
  // available for new outflows.
  // Reserved-for-work-orders: aggregate the *actual current contents* at this
  // vault for every in-progress WO whose current holder is this vault. Use
  // the chronological walk so the original "issued from vault" leg is NOT
  // subtracted (it predates the WO arriving back at the vault).
  const reservedKeyMap = new Map<string, number>()
  const reservedCatMap = new Map<string, Map<string, Bd>>()
  const reservedWos = workOrders.filter(
    (w) =>
      w.current_holder_type === "vault" &&
      w.current_holder_id === vaultId &&
      w.status === "in_progress",
  )
  for (const w of reservedWos) {
    const items = computeWorkOrderContents(movements, w.id, "vault", vaultId ?? null)
    for (const it of items) {
      const key = `${it.metal_id}__${it.karat ?? ""}`
      reservedKeyMap.set(key, (reservedKeyMap.get(key) ?? 0) + it.weight)
      if (it.category_id) {
        let inner = reservedCatMap.get(key)
        if (!inner) {
          inner = new Map()
          reservedCatMap.set(key, inner)
        }
        const cur = inner.get(it.category_id) ?? { weight: 0, count: null as number | null, name: it.category_name ?? "" }
        cur.weight += it.weight
        if (it.count != null) cur.count = (cur.count ?? 0) + it.count
        if (it.category_name && !cur.name) cur.name = it.category_name
        inner.set(it.category_id, cur)
      }
    }
  }

  type CardItem = InvRow & { metal: Metal | undefined; available: number; reserved: number }
  // Aggregate inventory rows by metal+karat (categories are shown as breakdown
  // inside the card, not as separate cards).
  const aggMap = new Map<string, { metal_id: string; karat: string | null; total_weight: number }>()
  for (const r of rows) {
    const k = `${r.metal_id}__${r.karat ?? ""}`
    const cur = aggMap.get(k) ?? { metal_id: r.metal_id, karat: r.karat, total_weight: 0 }
    cur.total_weight += Number(r.total_weight)
    aggMap.set(k, cur)
  }
  const allCards: CardItem[] = Array.from(aggMap.values())
    .map((r) => {
      const key = `${r.metal_id}__${r.karat ?? ""}`
      const reserved = Math.max(0, reservedKeyMap.get(key) ?? 0)
      const total = r.total_weight
      return {
        metal_id: r.metal_id,
        karat: r.karat,
        category_id: null,
        total_count: null,
        total_weight: total,
        metal: metals.find((m) => m.id === r.metal_id),
        available: total - reserved,
        reserved,
      }
    })
    .filter((r) => r.metal && (r.available > 0.0001 || r.reserved > 0.0001))
  const availableCards = allCards.filter((c) => c.available > 0.0001)
  const reservedCards = allCards.filter((c) => c.reserved > 0.0001)
  const cards = allCards

  const isActive = vault?.status === "active"
  const canEntry = vaultId ? hasPermission("create_vault_entry", vaultId) : false
  const canAccess = vaultId ? hasPermission("access_vault", vaultId) : false
  const canMovements = vaultId
    ? hasPermission("view_vault_movements", vaultId)
    : false

  if (!permLoading && vaultId && !canAccess) {
    return (
      <div className="mx-auto max-w-md">
        <PermCard>
          <PermCardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">لا تملك الصلاحية</h2>
            <p className="text-sm text-muted-foreground">ليس لديك صلاحية الدخول لهذه الخزنة.</p>
          </PermCardContent>
        </PermCard>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={vault?.name ?? "الخزنة"}
        description="تفاصيل الأوزان الموجودة في الخزنة"
        backTo="/vaults"
        breadcrumbs={[
          { label: "الخزن", to: "/vaults" },
          { label: vault?.name ?? "الخزنة" },
        ]}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {vault && (
              <Badge variant={vault.status === "active" ? "default" : "secondary"}>
                {vault.status === "active" ? "نشطة" : "معطلة"}
              </Badge>
            )}
            {canEntry && (
            <Button
              className="gap-2"
              onClick={() => setAddOpen(true)}
              disabled={!isActive || !activeShift}
              title={!activeShift ? "ابدأ شيفت أولاً لتسجيل أي حركة" : undefined}
            >
              <Plus className="h-4 w-4" />
              قيد دخول
            </Button>
            )}
            {canEntry && (
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => setExitOpen(true)}
              disabled={!isActive || !activeShift || rows.every((r) => Number(r.total_weight) <= 0)}
              title={!activeShift ? "ابدأ شيفت أولاً لتسجيل أي حركة" : undefined}
            >
              <Minus className="h-4 w-4" />
              قيد خروج
            </Button>
            )}
            {canEntry && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setAdjustOpen(true)}
              disabled={!isActive || !activeShift}
              title={!activeShift ? "ابدأ شيفت أولاً لتسجيل أي حركة" : undefined}
            >
              <Hash className="h-4 w-4" />
              تعديل الأعداد
            </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <StatGridSkeleton count={8} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
      ) : (
        <>
          {cards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <VaultIcon className="h-10 w-10" />
                <p>الخزنة فارغة</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {availableCards.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {availableCards.map((c, i) => {
                    const cls = metalClasses(c.metal!.color)
                    const key = `${c.metal_id}__${c.karat ?? ""}`
                    const inner = breakdownMap.get(key)
                    const reservedInner = reservedCatMap.get(key)
                    const breakdown = inner
                      ? Array.from(inner.entries())
                          .map(([id, b]) => {
                            const r = reservedInner?.get(id)
                            const w = b.weight - Math.max(0, r?.weight ?? 0)
                            const cnt =
                              b.count != null
                                ? b.count - Math.max(0, r?.count ?? 0)
                                : null
                            return { id, name: b.name, weight: w, count: cnt }
                          })
                          .filter((x) => x.weight > 0.0001)
                      : []
                    return (
                      <Card key={i} size="sm" className={`${cls.bg} ${cls.border} border`}>
                        <CardContent className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs ${cls.text}`}>{c.metal!.name_ar}</span>
                            {c.karat && (
                              <Badge variant="outline" className={`${cls.text} ${cls.border}`}>
                                عيار {c.karat}
                              </Badge>
                            )}
                          </div>
                          <div className={`text-xl font-bold tabular-nums ${cls.text}`}>
                            {formatWeight(c.available)}
                            <span className="ms-1 text-xs font-normal opacity-70">جم</span>
                          </div>
                          {breakdown.length > 0 && (
                            <div className={`mt-1 flex flex-col gap-0.5 border-t pt-1 text-xs ${cls.text} ${cls.border} opacity-80`}>
                              {breakdown.map((x) => (
                                <div key={x.id} className="flex items-center justify-between gap-2">
                                  <span>
                                    {x.count != null && x.count > 0 && (
                                      <span className="tabular-nums">{x.count}× </span>
                                    )}
                                    {x.name}
                                  </span>
                                  <span className="tabular-nums">
                                    {formatWeight(x.weight)}
                                    <span className="ms-1 opacity-70">جم</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    لا يوجد رصيد متاح حالياً (كل الأرصدة محجوزة لأوامر الشغل)
                  </CardContent>
                </Card>
              )}

              {reservedCards.length > 0 && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-muted-foreground">
                      محجوز لأوامر الشغل
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {reservedCards.map((c, i) => {
                      const cls = metalClasses(c.metal!.color)
                      const key = `${c.metal_id}__${c.karat ?? ""}`
                      const reservedInner = reservedCatMap.get(key)
                      const rBreakdown = reservedInner
                        ? Array.from(reservedInner.entries()).filter(([, b]) => b.weight > 0.0001)
                        : []
                      return (
                        <Card
                          key={i}
                          size="sm"
                          className={`${cls.bg} ${cls.border} border border-dashed opacity-90`}
                        >
                          <CardContent className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs ${cls.text}`}>{c.metal!.name_ar}</span>
                              {c.karat && (
                                <Badge variant="outline" className={`${cls.text} ${cls.border}`}>
                                  عيار {c.karat}
                                </Badge>
                              )}
                            </div>
                            <div className={`text-xl font-bold tabular-nums ${cls.text}`}>
                              {formatWeight(c.reserved)}
                              <span className="ms-1 text-xs font-normal opacity-70">جم</span>
                            </div>
                            {rBreakdown.length > 0 && (
                              <div className={`mt-1 flex flex-col gap-0.5 border-t pt-1 text-xs ${cls.text} ${cls.border} opacity-80`}>
                                {rBreakdown.map(([id, b]) => (
                                  <div key={id} className="flex items-center justify-between gap-2">
                                    <span>
                                      {b.count != null && b.count > 0 && (
                                        <span className="tabular-nums">{b.count}× </span>
                                      )}
                                      {b.name}
                                    </span>
                                    <span className="tabular-nums">
                                      {formatWeight(b.weight)}
                                      <span className="ms-1 opacity-70">جم</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {workOrders.filter((w) => w.current_holder_type === "vault" && w.current_holder_id === vaultId && w.status === "in_progress").length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">أوامر شغل في حوزة هذه الخزنة</h2>
              <div className="flex flex-col gap-3">
                {workOrders
                  .filter((w) => w.current_holder_type === "vault" && w.current_holder_id === vaultId && w.status === "in_progress")
                  .map((wo) => (
                    <WorkOrderCard key={wo.id} order={wo} movements={movements} onChanged={load} />
                  ))}
              </div>
            </div>
          )}

          {canMovements && (
            <Tabs defaultValue="movements" className="flex flex-col gap-3">
              <TabsList>
                <TabsTrigger value="movements">حركات الخزنة</TabsTrigger>
                <TabsTrigger value="work-orders">أوامر الشغل</TabsTrigger>
              </TabsList>
              <TabsContent value="movements">
                <DataTable
                  data={movements}
                  columns={movementColumns()}
                  rowKey={(r) => r.id}
                  searchKeys={["code", "from_name", "to_name", "metal_name", "employee_name"]}
                  searchPlaceholder="ابحث في حركات الخزنة..."
                  onRefresh={load}
                  emptyMessage="لا توجد حركات لهذه الخزنة بعد"
                />
              </TabsContent>
              <TabsContent value="work-orders">
                <DataTable
                  data={workOrders}
                  columns={workOrderColumns()}
                  rowKey={(r) => r.id}
                  searchKeys={["code", "vault_name", "section_name"]}
                  searchPlaceholder="ابحث في أوامر الشغل..."
                  onRefresh={load}
                  emptyMessage="لا توجد أوامر شغل صادرة من هذه الخزنة"
                />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {vault && (
        <AddInflowDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          vault={vault}
          metals={metals}
          shiftId={activeShift?.id ?? null}
          onCreated={load}
        />
      )}
      {vault && (
        <AddOutflowDialog
          open={exitOpen}
          onOpenChange={setExitOpen}
          vault={vault}
          metals={metals}
          inventory={rows}
          breakdown={breakdownMap}
          reservedKeyMap={reservedKeyMap}
          reservedCatMap={reservedCatMap}
          shiftId={activeShift?.id ?? null}
          onCreated={load}
        />
      )}
      {vault && (
        <AdjustCountsDialog
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          vault={vault}
          metals={metals}
          breakdown={breakdownMap}
          reservedCatMap={reservedCatMap}
          shiftId={activeShift?.id ?? null}
          onCreated={load}
        />
      )}
    </div>
  )
}

function AddInflowDialog({
  open,
  onOpenChange,
  vault,
  metals,
  shiftId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  vault: Vault
  metals: Metal[]
  shiftId: string | null
  onCreated: () => void
}) {
  const { displayName } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState<string>("")
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [karats, setKarats] = useState<{ metal_id: string; karat: string }[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  type EntryRow = {
    key: string
    metalId: string
    karat: string
    categoryId: string
    weight: string
    count: string
  }
  const newRow = (): EntryRow => ({
    key: crypto.randomUUID(),
    metalId: "",
    karat: "",
    categoryId: "",
    weight: "",
    count: "",
  })
  const [entries, setEntries] = useState<EntryRow[]>([newRow()])

  useEffect(() => {
    if (!open) return
    setSupplierId("")
    setEntries([newRow()])
    supabase
      .from("suppliers")
      .select("id,name")
      .order("name")
      .then(({ data }) => setSuppliers((data ?? []) as Supplier[]))
    supabase
      .from("metal_karats")
      .select("metal_id,karat")
      .then(({ data }) => setKarats((data ?? []) as { metal_id: string; karat: string }[]))
    supabase
      .from("metal_categories")
      .select("id,metal_id,name,requires_count,parent_id,sort_order")
      .order("name")
      .then(({ data }) => setCategories((data ?? []) as Category[]))
  }, [open, metals])

  const supplier = suppliers.find((s) => s.id === supplierId)

  const updateEntry = (key: string, patch: Partial<EntryRow>) => {
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

  const submit = async () => {
    if (!supplierId) return toast.error("اختر المورد")
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

    setSaving(true)

    const { error: mvErr } = await supabase.from("movements").insert(
      prepared.map((p) => ({
        from_type: "supplier",
        from_id: supplierId,
        to_type: "vault",
        to_id: vault.id,
        metal_id: p.metalId,
        karat: p.karat,
        weight: p.weight,
        employee_name: displayName,
        shift_id: shiftId,
        category_id: p.categoryId,
        count: p.count,
      })),
    )
    if (mvErr) {
      setSaving(false)
      return toast.error(mvErr.message || "فشل تسجيل الحركات")
    }

    setSaving(false)
    toast.success("تم تسجيل قيود الدخول")
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>قيد دخول جديد</DialogTitle>
          <DialogDescription>
            تسجيل دخول معدن إلى خزنة «{vault.name}» من أحد الموردين.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>المورد</Label>
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="justify-between"
                >
                  {supplier?.name ?? "اختر المورد..."}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                  <CommandInput placeholder="ابحث عن مورد..." />
                  <CommandList>
                    <CommandEmpty>لا يوجد موردون</CommandEmpty>
                    <CommandGroup>
                      {suppliers.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => {
                            setSupplierId(s.id)
                            setSupplierOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              supplierId === s.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center justify-between">
            <Label>الأصناف المُستلمة</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addRow}>
              <Plus className="h-4 w-4" />
              إضافة سطر
            </Button>
          </div>

          <div className="scrollbar-thin flex max-h-[55vh] flex-col gap-3 overflow-y-auto overflow-x-auto pe-2">
            {entries.map((e, idx) => {
              const requiresCount =
                !!e.categoryId && categoryRequiresCount(e.categoryId, categories)
              return (
                <div
                  key={e.key}
                  className="flex w-max min-w-full flex-col gap-2 rounded-md border bg-muted/30 p-3"
                >
                  <span className="text-xs text-muted-foreground">سطر {idx + 1}</span>
                  <div className="flex items-end gap-2">
                    <div className="flex w-40 flex-col gap-1.5">
                      <Label className="text-xs">نوع المعدن</Label>
                      <SearchableSelect
                        value={e.metalId}
                        onValueChange={(v) => updateEntry(e.key, { metalId: v })}
                        placeholder="المعدن"
                        options={metals.map((m) => ({
                          value: m.id,
                          label: m.name_ar,
                          search: m.name_ar,
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
                        disabled={!requiresCount}
                      />
                    </div>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            حفظ القيود
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default VaultDetailPage

function AddOutflowDialog({
  open,
  onOpenChange,
  vault,
  metals,
  inventory,
  breakdown,
  reservedKeyMap,
  reservedCatMap,
  shiftId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  vault: Vault
  metals: Metal[]
  inventory: InvRow[]
  breakdown: Map<string, Map<string, { weight: number; count: number | null; name: string }>>
  reservedKeyMap: Map<string, number>
  reservedCatMap: Map<string, Map<string, { weight: number; count: number | null; name: string }>>
  shiftId: string | null
  onCreated: () => void
}) {
  const { displayName } = useAuth()
  type DestType = "supplier" | "vault" | "section" | "section_processing"
  const [destType, setDestType] = useState<DestType>("supplier")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [otherVaults, setOtherVaults] = useState<{ id: string; name: string }[]>([])
  const [sections, setSections] = useState<{ id: string; name: string }[]>([])
  const [processingSections, setProcessingSections] = useState<{ id: string; name: string }[]>([])
  const [workOrderNotes, setWorkOrderNotes] = useState("")
  const [destId, setDestId] = useState<string>("")
  const [destOpen, setDestOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [destAllowedMetalIds, setDestAllowedMetalIds] = useState<Set<string> | null>(null)
  type ExitRow = {
    key: string
    metalId: string
    karat: string
    categoryId: string
    weight: string
    count: string
  }
  const newRow = (): ExitRow => ({
    key: crypto.randomUUID(),
    metalId: "",
    karat: "",
    categoryId: "",
    weight: "",
    count: "",
  })
  const [entries, setEntries] = useState<ExitRow[]>([newRow()])

  useEffect(() => {
    if (!open) return
    setDestId("")
    setDestType("supplier")
    setEntries([newRow()])
    setDestAllowedMetalIds(null)
    setWorkOrderNotes("")
    supabase
      .from("suppliers")
      .select("id,name")
      .order("name")
      .then(({ data }) => setSuppliers((data ?? []) as Supplier[]))
    supabase
      .from("vaults")
      .select("id,name")
      .eq("status", "active")
      .order("name")
      .then(({ data }) =>
        setOtherVaults(((data ?? []) as { id: string; name: string }[]).filter((v) => v.id !== vault.id)),
      )
    supabase
      .from("manufacturing_sections")
      .select("id,name,kind")
      .eq("status", "active")
      .order("name")
      .then(({ data }) => {
        const all = (data ?? []) as { id: string; name: string; kind: string }[]
        setSections(all.map((s) => ({ id: s.id, name: s.name })))
        setProcessingSections([])
      })
    supabase
      .from("metal_categories")
      .select("id,metal_id,name,requires_count,parent_id,sort_order")
      .order("name")
      .then(({ data }) => setCategories((data ?? []) as Category[]))
  }, [open, vault.id])

  // Load allowed metals for destination vault/section to validate compatibility
  useEffect(() => {
    if (!open) return
    if (
      (destType !== "vault" && destType !== "section" && destType !== "section_processing") ||
      !destId
    ) {
      setDestAllowedMetalIds(null)
      return
    }
    if (destType === "vault") {
      supabase
        .from("vault_metals")
        .select("metal_id")
        .eq("vault_id", destId)
        .then(({ data }) =>
          setDestAllowedMetalIds(new Set((data ?? []).map((x) => x.metal_id as string))),
        )
    } else {
      supabase
        .from("section_metals")
        .select("metal_id")
        .eq("section_id", destId)
        .then(({ data }) =>
          setDestAllowedMetalIds(new Set((data ?? []).map((x) => x.metal_id as string))),
        )
    }
  }, [open, destType, destId])

  // available rows: only metals/karats present in this vault with weight > 0
  const available = inventory.filter((r) => Number(r.total_weight) > 0)
  const availableMetals = metals.filter((m) => available.some((r) => r.metal_id === m.id))

  const dest =
    destType === "supplier"
      ? suppliers.find((s) => s.id === destId)
      : destType === "vault"
        ? otherVaults.find((v) => v.id === destId)
        : destType === "section_processing"
          ? processingSections.find((s) => s.id === destId)
          : sections.find((s) => s.id === destId)

  const updateEntry = (key: string, patch: Partial<ExitRow>) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.key !== key) return e
        const next = { ...e, ...patch }
        if (patch.metalId !== undefined && patch.metalId !== e.metalId) {
          next.karat = ""
          next.categoryId = ""
          next.count = ""
          next.weight = ""
        }
        if (patch.karat !== undefined && patch.karat !== e.karat) {
          next.weight = ""
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

  const availableFor = (metalId: string, karat: string) => {
    const total = inventory
      .filter((r) => r.metal_id === metalId && (r.karat ?? "") === karat)
      .reduce((sum, r) => sum + Number(r.total_weight), 0)
    const reserved = Math.max(0, reservedKeyMap.get(`${metalId}__${karat}`) ?? 0)
    return Math.max(0, total - reserved)
  }
  const metalAllowedAtDest = (metalId: string) => {
    if (destType === "supplier") return true
    if (!destAllowedMetalIds) return true // not loaded yet
    return destAllowedMetalIds.has(metalId)
  }
  // المتاح حسب التصنيف (الداخل - الخارج لكل تصنيف) مطروحاً منه المحجوز لأوامر الشغل
  const availableForCategory = (metalId: string, karat: string, categoryId: string) => {
    const rowsForCategory = inventory.filter(
      (r) =>
        r.metal_id === metalId &&
        (r.karat ?? "") === karat &&
        r.category_id === categoryId,
    )
    const total = rowsForCategory.length > 0
      ? rowsForCategory.reduce((sum, r) => sum + Number(r.total_weight), 0)
      : Number(breakdown.get(`${metalId}__${karat}`)?.get(categoryId)?.weight ?? 0)
    const reservedInner = reservedCatMap.get(`${metalId}__${karat}`)
    const reserved = Math.max(0, reservedInner?.get(categoryId)?.weight ?? 0)
    return Math.max(0, total - reserved)
  }
  // العدد المتاح حسب التصنيف
  const availableCountForCategory = (metalId: string, karat: string, categoryId: string) => {
    const rowsForCategory = inventory.filter(
      (r) =>
        r.metal_id === metalId &&
        (r.karat ?? "") === karat &&
        r.category_id === categoryId,
    )
    const fallbackCount = breakdown.get(`${metalId}__${karat}`)?.get(categoryId)?.count
    const totalC = rowsForCategory.some((r) => r.total_count != null)
      ? rowsForCategory.reduce((sum, r) => sum + Number(r.total_count ?? 0), 0)
      : fallbackCount ?? null
    if (totalC == null) return null
    const reservedInner = reservedCatMap.get(`${metalId}__${karat}`)
    const reservedC = Math.max(0, reservedInner?.get(categoryId)?.count ?? 0)
    return Math.max(0, totalC - reservedC)
  }
  // هل لدى المعدن أي تصنيفات (لإلزام المستخدم باختيار تصنيف عند الخروج)
  const metalHasAnyCategory = (metalId: string) =>
    !!metalId && categories.some((c) => c.metal_id === metalId)

  const submit = async () => {
    if (!destId)
      return toast.error(
        destType === "supplier"
          ? "اختر المورد"
          : destType === "vault"
            ? "اختر الخزنة"
            : "اختر القسم",
      )
    if (entries.length === 0) return toast.error("أضف سطراً واحداً على الأقل")

    type Prepared = {
      metalId: string
      karat: string
      weight: number
      categoryId: string | null
      count: number | null
    }
    const prepared: Prepared[] = []
    // aggregate per metal+karat+category to validate against current available
    const totalsKey = new Map<string, number>()
    const totalsCat = new Map<string, number>()
    const totalsCount = new Map<string, number>()
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const idx = i + 1
      if (!e.metalId) return toast.error(`السطر ${idx}: اختر نوع المعدن`)
      if (!e.karat.trim()) return toast.error(`السطر ${idx}: اختر العيار`)
      if (!metalAllowedAtDest(e.metalId)) {
        const mname = metals.find((m) => m.id === e.metalId)?.name_ar ?? ""
        return toast.error(`السطر ${idx}: الوجهة لا تقبل ${mname}`)
      }
      const hasCats = metalHasAnyCategory(e.metalId)
      if (hasCats && !e.categoryId)
        return toast.error(`السطر ${idx}: اختر التصنيف`)
      if (e.categoryId) {
        const hasChildren = categories.some((c) => c.parent_id === e.categoryId)
        if (hasChildren) return toast.error(`السطر ${idx}: اختر تصنيف فرعي`)
      }
      const w = Number(e.weight)
      if (!w || w <= 0) return toast.error(`السطر ${idx}: ادخل وزناً صحيحاً`)
      const avail = availableFor(e.metalId, e.karat)
      const k = `${e.metalId}__${e.karat}`
      const used = (totalsKey.get(k) ?? 0) + w
      if (used > avail + 0.0001)
        return toast.error(`السطر ${idx}: الرصيد المتاح ${avail} جم فقط`)
      totalsKey.set(k, used)
      const sel = categories.find((c) => c.id === e.categoryId)
      if (sel) {
        const catAvail = availableForCategory(e.metalId, e.karat, sel.id)
        if (catAvail <= 0.0001)
          return toast.error(
            `السطر ${idx}: لا يوجد رصيد متاح من «${sel.name}»`,
          )
        const ck = `${k}__${sel.id}`
        const usedCat = (totalsCat.get(ck) ?? 0) + w
        if (usedCat > catAvail + 0.0001)
          return toast.error(
            `السطر ${idx}: المتاح من «${sel.name}» ${catAvail} جم فقط`,
          )
        totalsCat.set(ck, usedCat)
      }
      let countValue: number | null = null
      const requiresCnt =
        !!e.categoryId && categoryRequiresCount(e.categoryId, categories)
      if (requiresCnt && sel) {
        const c = Number(e.count)
        if (!c || c <= 0 || !Number.isInteger(c))
          return toast.error(`السطر ${idx}: ادخل عدداً صحيحاً`)
        countValue = c
        const countAvail = availableCountForCategory(e.metalId, e.karat, sel.id)
        if (countAvail != null) {
          const ck = `${e.metalId}__${e.karat}__${sel.id}`
          const usedCnt = (totalsCount.get(ck) ?? 0) + c
          if (usedCnt > countAvail)
            return toast.error(
              `السطر ${idx}: العدد المتاح من «${sel.name}» ${countAvail} فقط`,
            )
          totalsCount.set(ck, usedCnt)
        }
        // قاعدة القطعة الواحدة: لو المتاح قطعة واحدة فقط، لازم تأخذ كامل وزنها
        const catAvailW = availableForCategory(e.metalId, e.karat, sel.id)
        if (countAvail === 1 && c === 1 && Math.abs(w - catAvailW) > 0.0001) {
          return toast.error(
            `السطر ${idx}: لا يمكن إخراج وزن جزئي من قطعة واحدة (المتاح ${catAvailW} جم)`,
          )
        }
      }
      prepared.push({
        metalId: e.metalId,
        karat: e.karat.trim(),
        weight: w,
        categoryId: e.categoryId || null,
        count: countValue,
      })
    }

    setSaving(true)
    let workOrderId: string | null = null
    if (destType === "section" || destType === "section_processing") {
      const { data: wo, error: woErr } = await supabase
        .from("work_orders")
        .insert({
          from_vault_id: vault.id,
          to_section_id: destId,
          notes: workOrderNotes.trim() || null,
          shift_id: shiftId,
        })
        .select("id")
        .single()
      if (woErr || !wo) {
        setSaving(false)
        return toast.error(woErr?.message || "فشل إنشاء أمر الشغل")
      }
      workOrderId = wo.id
    }
    const { error: mvErr } = await supabase.from("movements").insert(
      prepared.map((p) => ({
        from_type: "vault",
        from_id: vault.id,
        to_type: destType === "section_processing" ? "section" : destType,
        to_id: destId,
        metal_id: p.metalId,
        karat: p.karat,
        weight: p.weight,
        employee_name: displayName,
        shift_id: shiftId,
        category_id: p.categoryId,
        count: p.count,
        work_order_id: workOrderId,
      })),
    )
    if (mvErr) {
      setSaving(false)
      if (workOrderId) {
        await supabase.from("work_orders").delete().eq("id", workOrderId)
      }
      return toast.error(mvErr.message || "فشل تسجيل الحركات")
    }
    setSaving(false)
    toast.success(
      destType === "section" || destType === "section_processing"
        ? "تم إنشاء أمر الشغل"
        : "تم تسجيل قيود الخروج",
    )
    onOpenChange(false)
    onCreated()
  }

  const destList =
    destType === "supplier"
      ? suppliers
      : destType === "vault"
        ? otherVaults
        : destType === "section_processing"
          ? processingSections
          : sections

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>قيد خروج جديد</DialogTitle>
          <DialogDescription>
            تسجيل خروج معدن من خزنة «{vault.name}» إلى مورد أو خزنة أخرى.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto -mx-4 px-4">
          <div className="flex flex-col gap-2">
            <Label>وجهة الخروج</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={destType === "supplier" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDestType("supplier")
                  setDestId("")
                }}
              >
                إلى مورد
              </Button>
              <Button
                type="button"
                variant={destType === "vault" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDestType("vault")
                  setDestId("")
                }}
              >
                إلى خزنة أخرى
              </Button>
              <Button
                type="button"
                variant={destType === "section" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDestType("section")
                  setDestId("")
                }}
              >
                إلى قسم تصنيع (أمر شغل)
              </Button>
            </div>
            <Popover open={destOpen} onOpenChange={setDestOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="justify-between">
                  {dest?.name ??
                    (destType === "supplier"
                      ? "اختر المورد..."
                      : destType === "vault"
                        ? "اختر الخزنة..."
                        : "اختر القسم...")}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                  <CommandInput placeholder="ابحث..." />
                  <CommandList>
                    <CommandEmpty>لا توجد نتائج</CommandEmpty>
                    <CommandGroup>
                      {destList.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => {
                            setDestId(s.id)
                            setDestOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              destId === s.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {(destType === "section" || destType === "section_processing") && (
            <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-primary">
                سيتم إنشاء أمر شغل جديد عند الحفظ. يمكنك إضافة ملاحظات للأمر هنا.
              </p>
              <Textarea
                value={workOrderNotes}
                onChange={(ev) => setWorkOrderNotes(ev.target.value)}
                placeholder="ملاحظات أمر الشغل (اختياري)"
                rows={3}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>الأصناف المُخرَجة</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addRow}>
              <Plus className="h-4 w-4" />
              إضافة سطر
            </Button>
          </div>

          <div className="scrollbar-thin flex max-h-[55vh] flex-col gap-3 overflow-y-auto overflow-x-auto pe-2">
            {entries.map((e, idx) => {
              const hasCats = metalHasAnyCategory(e.metalId)
              const sel = categories.find((c) => c.id === e.categoryId)
              const requiresCount =
                !!e.categoryId && categoryRequiresCount(e.categoryId, categories)
              const karatsForMetal = Array.from(
                new Set(
                  available
                    .filter((r) => r.metal_id === e.metalId)
                    .map((r) => r.karat ?? ""),
                ),
              )
              const avail = e.metalId && e.karat ? availableFor(e.metalId, e.karat) : 0
              const catAvail =
                sel && e.metalId && e.karat
                  ? availableForCategory(e.metalId, e.karat, sel.id)
                  : null
              const catCountAvail =
                sel && e.metalId && e.karat
                  ? availableCountForCategory(e.metalId, e.karat, sel.id)
                  : null
              const displayAvail = catAvail ?? avail
              const metalNotAllowed = e.metalId && !metalAllowedAtDest(e.metalId)
              return (
                <div
                  key={e.key}
                  className="flex w-max min-w-full flex-col gap-2 rounded-md border bg-muted/30 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">سطر {idx + 1}</span>
                    {e.metalId && e.karat && (
                      <span className="text-xs text-muted-foreground">
                        المتاح: {formatWeight(displayAvail)} جم
                        {catAvail != null && catCountAvail != null && (
                          <> · العدد: {catCountAvail}</>
                        )}
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
                        options={availableMetals.map((m) => ({
                          value: m.id,
                          label: m.name_ar,
                          search: m.name_ar,
                        }))}
                      />
                    </div>
                    <div className="flex w-24 flex-col gap-1.5">
                      <Label className="text-xs">العيار</Label>
                      <SearchableSelect
                        value={e.karat}
                        onValueChange={(v) => updateEntry(e.key, { karat: v })}
                        disabled={!e.metalId}
                        placeholder="العيار"
                        options={karatsForMetal.map((k) => ({
                          value: k,
                          label: k || "—",
                          search: k,
                          dir: "ltr" as const,
                        }))}
                      />
                    </div>
                    {e.metalId && e.karat && (
                      <CategoryCascade
                        metalId={e.metalId}
                        categories={categories}
                        value={e.categoryId}
                        onChange={(v) => updateEntry(e.key, { categoryId: v })}
                        leafFilter={(c) =>
                          availableForCategory(e.metalId, e.karat, c.id) > 0.0001
                        }
                      />
                    )}
                    <div className="flex w-28 flex-col gap-1.5">
                      <Label className="text-xs">الوزن (جم)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        max={(catAvail ?? avail) || undefined}
                        value={e.weight}
                        onChange={(ev) => updateEntry(e.key, { weight: ev.target.value })}
                        placeholder="0.000"
                        dir="ltr"
                        disabled={!e.metalId || !e.karat || (hasCats && !e.categoryId)}
                      />
                    </div>
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
                        disabled={!requiresCount}
                      />
                    </div>
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
                  {metalNotAllowed && (
                    <div className="text-xs text-destructive">
                      الخزنة الوجهة لا تقبل {metals.find((m) => m.id === e.metalId)?.name_ar}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={submit}
            disabled={
              saving ||
              entries.some((e) => e.metalId && !metalAllowedAtDest(e.metalId))
            }
          >
            حفظ القيود
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdjustCountsDialog({
  open,
  onOpenChange,
  vault,
  metals,
  breakdown,
  reservedCatMap,
  shiftId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  vault: Vault
  metals: Metal[]
  breakdown: Map<string, Map<string, { weight: number; count: number | null; name: string }>>
  reservedCatMap: Map<string, Map<string, { weight: number; count: number | null; name: string }>>
  shiftId: string | null
  onCreated: () => void
}) {
  const { displayName } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setEdits({})
    supabase
      .from("metal_categories")
      .select("id,metal_id,name,requires_count,parent_id,sort_order")
      .then(({ data }) => setCategories((data ?? []) as Category[]))
  }, [open])

  type Item = {
    key: string
    metal_id: string
    metal_name: string
    karat: string | null
    category_id: string
    category_name: string
    weight: number
    count: number
  }
  const items: Item[] = []
  for (const [mkKey, inner] of breakdown.entries()) {
    const sep = mkKey.indexOf("__")
    const metal_id = mkKey.slice(0, sep)
    const karat = mkKey.slice(sep + 2)
    const metal = metals.find((m) => m.id === metal_id)
    if (!metal) continue
    const reservedInner = reservedCatMap.get(mkKey)
    for (const [cat_id, b] of inner.entries()) {
      if (b.count == null) continue
      const r = reservedInner?.get(cat_id)
      const w = b.weight - Math.max(0, r?.weight ?? 0)
      const c = b.count - Math.max(0, r?.count ?? 0)
      if (w <= 0.0001 || c <= 0) continue
      const cat = categories.find((cc) => cc.id === cat_id)
      if (!cat) continue
      items.push({
        key: `${metal_id}__${karat}__${cat.id}`,
        metal_id,
        metal_name: metal.name_ar,
        karat: karat || null,
        category_id: cat.id,
        category_name: b.name || cat.name,
        weight: w,
        count: c,
      })
    }
  }

  const submit = async () => {
    type Ins = {
      from_type: string
      from_id: string
      to_type: string
      to_id: string
      metal_id: string
      karat: string | null
      weight: number
      category_id: string
      count: number
      employee_name: string | null
      shift_id: string | null
    }
    const inserts: Ins[] = []
    for (const it of items) {
      const raw = edits[it.key]
      if (raw == null || raw === "") continue
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 1) {
        return toast.error(`عدد غير صالح لـ ${it.category_name}`)
      }
      const delta = n - it.count
      if (delta === 0) continue
      if (delta > 0) {
        inserts.push({
          from_type: "adjustment",
          from_id: vault.id,
          to_type: "vault",
          to_id: vault.id,
          metal_id: it.metal_id,
          karat: it.karat,
          weight: 0,
          category_id: it.category_id,
          count: delta,
          employee_name: displayName,
          shift_id: shiftId,
        })
      } else {
        inserts.push({
          from_type: "vault",
          from_id: vault.id,
          to_type: "adjustment",
          to_id: vault.id,
          metal_id: it.metal_id,
          karat: it.karat,
          weight: 0,
          category_id: it.category_id,
          count: -delta,
          employee_name: displayName,
          shift_id: shiftId,
        })
      }
    }
    if (inserts.length === 0) return toast.error("لم تقم بأي تعديل")
    setSaving(true)
    const { error } = await supabase.from("movements").insert(inserts)
    setSaving(false)
    if (error) return toast.error(error.message || "فشل حفظ التعديلات")
    toast.success("تم تعديل الأعداد")
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>تعديل الأعداد</DialogTitle>
          <DialogDescription>
            تعديل عدد القطع فقط (مثلاً تحويل 1 سبيكة إلى 2). لا يمكن تعديل الوزن أو العيار من هنا.
          </DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin flex max-h-[55vh] flex-col gap-2 overflow-y-auto pe-1">
          {items.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              لا توجد أصناف بعدد معروف لتعديلها
            </div>
          ) : (
            items.map((it) => (
              <div
                key={it.key}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{it.metal_name}</span>
                    {it.karat && (
                      <Badge variant="outline" className="text-xs">عيار {it.karat}</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">{it.category_name}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    الوزن: {formatWeight(it.weight)} جم — الحالي: {it.count}×
                  </div>
                </div>
                <div className="flex w-28 flex-col gap-1.5">
                  <Label className="text-xs">العدد الجديد</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={edits[it.key] ?? ""}
                    onChange={(ev) => setEdits((p) => ({ ...p, [it.key]: ev.target.value }))}
                    placeholder={String(it.count)}
                    dir="ltr"
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={saving || items.length === 0}>حفظ التعديلات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
