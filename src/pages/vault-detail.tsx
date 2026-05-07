import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowRight, Vault as VaultIcon, Plus, Check, ChevronsUpDown, Trash2, Minus } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "@/components/data-table"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"
import { useActiveShift } from "@/hooks/use-active-shift"
import { usePermissions } from "@/hooks/use-permissions"
import { Card as PermCard, CardContent as PermCardContent } from "@/components/ui/card"
import { Lock } from "lucide-react"

type Vault = { id: string; name: string; status: string }
type Metal = { id: string; code: string; name_ar: string; color: string }
type InvRow = { metal_id: string; total_weight: number; karat: string | null }
type Supplier = { id: string; name: string }
type Category = { id: string; metal_id: string; name: string; requires_count: boolean }

export function VaultDetailPage() {
  const { vaultId } = useParams<{ vaultId: string }>()
  const { hasPermission, loading: permLoading } = usePermissions()
  const [vault, setVault] = useState<Vault | null>(null)
  const [metals, setMetals] = useState<Metal[]>([])
  const [rows, setRows] = useState<InvRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const { shift: activeShift } = useActiveShift()

  const load = async () => {
    if (!vaultId) return
    setLoading(true)
    const [v, m, inv, vm, mv] = await Promise.all([
      supabase.from("vaults").select("id,name,status").eq("id", vaultId).single(),
      supabase.from("metals").select("id,code,name_ar,color").eq("enabled", true),
      supabase.from("vault_inventory").select("metal_id,total_weight,karat").eq("vault_id", vaultId),
      supabase.from("vault_metals").select("metal_id").eq("vault_id", vaultId),
      fetchMovementRows({ vaultId }),
    ])
    const allowedIds = new Set((vm.data ?? []).map((x) => x.metal_id))
    setVault((v.data ?? null) as Vault | null)
    setMetals(((m.data ?? []) as Metal[]).filter((mm) => allowedIds.has(mm.id)))
    setRows((inv.data ?? []) as InvRow[])
    setMovements(mv)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultId])

  const cards = rows
    .filter((r) => Number(r.total_weight) > 0)
    .map((r) => ({
      ...r,
      metal: metals.find((m) => m.id === r.metal_id),
    }))
    .filter((r) => r.metal)

  // breakdown per metal+karat+category from movements (in - out)
  const breakdownMap = new Map<string, Map<string, number>>()
  for (const mv of movements) {
    if (!mv.category_name) continue
    const sign = mv.to_type === "vault" && mv.to_id === vaultId ? 1 : mv.from_type === "vault" && mv.from_id === vaultId ? -1 : 0
    if (!sign) continue
    const key = `${mv.metal_id}__${mv.karat ?? ""}`
    let inner = breakdownMap.get(key)
    if (!inner) { inner = new Map(); breakdownMap.set(key, inner) }
    inner.set(mv.category_name, (inner.get(mv.category_name) ?? 0) + sign * Number(mv.weight))
  }

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
        actions={
          <div className="flex items-center gap-2">
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
            <Button asChild variant="outline" className="gap-2">
              <Link to="/vaults">
                <ArrowRight className="h-4 w-4" />
                رجوع
              </Link>
            </Button>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c, i) => {
            const cls = metalClasses(c.metal!.color)
            const inner = breakdownMap.get(`${c.metal_id}__${c.karat ?? ""}`)
            const breakdown = inner
              ? Array.from(inner.entries()).filter(([, w]) => w > 0.0001)
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
                    {Number(c.total_weight).toLocaleString("ar-EG", { maximumFractionDigits: 3 })}
                    <span className="ms-1 text-xs font-normal opacity-70">جم</span>
                  </div>
                  {breakdown.length > 0 && (
                    <div className={`mt-1 flex flex-col gap-0.5 border-t pt-1 text-xs ${cls.text} ${cls.border} opacity-80`}>
                      {breakdown.map(([name, w]) => (
                        <div key={name} className="flex items-center justify-between gap-2">
                          <span>{name}</span>
                          <span className="tabular-nums">
                            {w.toLocaleString("ar-EG", { maximumFractionDigits: 3 })}
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
          )}

          {canMovements && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">حركات الخزنة</h2>
            <DataTable
              data={movements}
              columns={movementColumns()}
              rowKey={(r) => r.id}
              searchKeys={["code", "from_name", "to_name", "metal_name", "employee_name"]}
              searchPlaceholder="ابحث في حركات الخزنة..."
              onRefresh={load}
              emptyMessage="لا توجد حركات لهذه الخزنة بعد"
            />
          </div>
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
      .select("id,metal_id,name,requires_count")
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
      const cats = categories.filter((c) => c.metal_id === e.metalId)
      if (cats.length > 0 && !e.categoryId)
        return toast.error(`السطر ${idx}: اختر التصنيف`)
      const w = Number(e.weight)
      if (!w || w <= 0) return toast.error(`السطر ${idx}: ادخل وزناً صحيحاً`)
      const sel = categories.find((c) => c.id === e.categoryId)
      let countValue: number | null = null
      if (sel?.requires_count) {
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
              const cats = categories.filter((c) => c.metal_id === e.metalId)
              const sel = categories.find((c) => c.id === e.categoryId)
              const requiresCount = !!sel?.requires_count
              return (
                <div
                  key={e.key}
                  className="flex w-max min-w-full flex-col gap-2 rounded-md border bg-muted/30 p-3"
                >
                  <span className="text-xs text-muted-foreground">سطر {idx + 1}</span>
                  <div className="flex items-end gap-2">
                    <div className="flex w-40 flex-col gap-1.5">
                      <Label className="text-xs">نوع المعدن</Label>
                      <Select
                        value={e.metalId}
                        onValueChange={(v) => updateEntry(e.key, { metalId: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="المعدن" />
                        </SelectTrigger>
                        <SelectContent>
                          {metals.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name_ar}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex w-24 flex-col gap-1.5">
                      <Label className="text-xs">العيار</Label>
                      <Select
                        value={e.karat}
                        onValueChange={(v) => updateEntry(e.key, { karat: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="العيار" />
                        </SelectTrigger>
                        <SelectContent>
                          {karats
                            .filter((k) => k.metal_id === e.metalId)
                            .map((k) => (
                              <SelectItem key={k.karat} value={k.karat} dir="ltr">
                                {k.karat}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex w-40 flex-col gap-1.5">
                      <Label className="text-xs">التصنيف</Label>
                      <Select
                        value={e.categoryId}
                        onValueChange={(v) => updateEntry(e.key, { categoryId: v })}
                        disabled={cats.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={cats.length === 0 ? "—" : "التصنيف"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {cats.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
  shiftId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  vault: Vault
  metals: Metal[]
  inventory: InvRow[]
  shiftId: string | null
  onCreated: () => void
}) {
  const { displayName } = useAuth()
  type DestType = "supplier" | "vault"
  const [destType, setDestType] = useState<DestType>("supplier")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [otherVaults, setOtherVaults] = useState<{ id: string; name: string }[]>([])
  const [destId, setDestId] = useState<string>("")
  const [destOpen, setDestOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
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
      .from("metal_categories")
      .select("id,metal_id,name,requires_count")
      .order("name")
      .then(({ data }) => setCategories((data ?? []) as Category[]))
  }, [open, vault.id])

  // available rows: only metals/karats present in this vault with weight > 0
  const available = inventory.filter((r) => Number(r.total_weight) > 0)
  const availableMetals = metals.filter((m) => available.some((r) => r.metal_id === m.id))

  const dest =
    destType === "supplier"
      ? suppliers.find((s) => s.id === destId)
      : otherVaults.find((v) => v.id === destId)

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

  const availableFor = (metalId: string, karat: string) =>
    Number(
      inventory.find((r) => r.metal_id === metalId && (r.karat ?? "") === karat)?.total_weight ?? 0,
    )

  const submit = async () => {
    if (!destId) return toast.error(destType === "supplier" ? "اختر المورد" : "اختر الخزنة")
    if (entries.length === 0) return toast.error("أضف سطراً واحداً على الأقل")

    type Prepared = {
      metalId: string
      karat: string
      weight: number
      categoryId: string | null
      count: number | null
    }
    const prepared: Prepared[] = []
    // aggregate per metal+karat to validate against current available
    const totalsKey = new Map<string, number>()
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const idx = i + 1
      if (!e.metalId) return toast.error(`السطر ${idx}: اختر نوع المعدن`)
      if (!e.karat.trim()) return toast.error(`السطر ${idx}: اختر العيار`)
      const cats = categories.filter((c) => c.metal_id === e.metalId)
      if (cats.length > 0 && !e.categoryId)
        return toast.error(`السطر ${idx}: اختر التصنيف`)
      const w = Number(e.weight)
      if (!w || w <= 0) return toast.error(`السطر ${idx}: ادخل وزناً صحيحاً`)
      const avail = availableFor(e.metalId, e.karat)
      const k = `${e.metalId}__${e.karat}`
      const used = (totalsKey.get(k) ?? 0) + w
      if (used > avail + 0.0001)
        return toast.error(`السطر ${idx}: الرصيد المتاح ${avail} جم فقط`)
      totalsKey.set(k, used)
      const sel = categories.find((c) => c.id === e.categoryId)
      let countValue: number | null = null
      if (sel?.requires_count) {
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
        from_type: "vault",
        from_id: vault.id,
        to_type: destType,
        to_id: destId,
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
    toast.success("تم تسجيل قيود الخروج")
    onOpenChange(false)
    onCreated()
  }

  const destList = destType === "supplier" ? suppliers : otherVaults

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>قيد خروج جديد</DialogTitle>
          <DialogDescription>
            تسجيل خروج معدن من خزنة «{vault.name}» إلى مورد أو خزنة أخرى.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>وجهة الخروج</Label>
            <div className="flex gap-2">
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
            </div>
            <Popover open={destOpen} onOpenChange={setDestOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="justify-between">
                  {dest?.name ?? (destType === "supplier" ? "اختر المورد..." : "اختر الخزنة...")}
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

          <div className="flex items-center justify-between">
            <Label>الأصناف المُخرَجة</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addRow}>
              <Plus className="h-4 w-4" />
              إضافة سطر
            </Button>
          </div>

          <div className="scrollbar-thin flex max-h-[55vh] flex-col gap-3 overflow-y-auto overflow-x-auto pe-2">
            {entries.map((e, idx) => {
              const cats = categories.filter((c) => c.metal_id === e.metalId)
              const sel = categories.find((c) => c.id === e.categoryId)
              const requiresCount = !!sel?.requires_count
              const karatsForMetal = Array.from(
                new Set(
                  available
                    .filter((r) => r.metal_id === e.metalId)
                    .map((r) => r.karat ?? ""),
                ),
              )
              const avail = e.metalId && e.karat ? availableFor(e.metalId, e.karat) : 0
              return (
                <div
                  key={e.key}
                  className="flex w-max min-w-full flex-col gap-2 rounded-md border bg-muted/30 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">سطر {idx + 1}</span>
                    {e.metalId && e.karat && (
                      <span className="text-xs text-muted-foreground">
                        المتاح: {avail.toLocaleString("ar-EG", { maximumFractionDigits: 3 })} جم
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex w-40 flex-col gap-1.5">
                      <Label className="text-xs">نوع المعدن</Label>
                      <Select
                        value={e.metalId}
                        onValueChange={(v) => updateEntry(e.key, { metalId: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="المعدن" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMetals.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name_ar}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex w-24 flex-col gap-1.5">
                      <Label className="text-xs">العيار</Label>
                      <Select
                        value={e.karat}
                        onValueChange={(v) => updateEntry(e.key, { karat: v })}
                        disabled={!e.metalId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="العيار" />
                        </SelectTrigger>
                        <SelectContent>
                          {karatsForMetal.map((k) => (
                            <SelectItem key={k} value={k} dir="ltr">
                              {k || "—"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex w-40 flex-col gap-1.5">
                      <Label className="text-xs">التصنيف</Label>
                      <Select
                        value={e.categoryId}
                        onValueChange={(v) => updateEntry(e.key, { categoryId: v })}
                        disabled={cats.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={cats.length === 0 ? "—" : "التصنيف"} />
                        </SelectTrigger>
                        <SelectContent>
                          {cats.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex w-28 flex-col gap-1.5">
                      <Label className="text-xs">الوزن (جم)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        max={avail || undefined}
                        value={e.weight}
                        onChange={(ev) => updateEntry(e.key, { weight: ev.target.value })}
                        placeholder="0.000"
                        dir="ltr"
                        disabled={!e.metalId || !e.karat}
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
