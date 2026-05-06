import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowRight, Vault as VaultIcon, Plus, Check, ChevronsUpDown, Trash2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { metalClasses } from "@/lib/metal-colors"
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

type Vault = { id: string; name: string; status: string }
type Metal = { id: string; code: string; name_ar: string; color: string }
type InvRow = { metal_id: string; total_weight: number; karat: string | null }
type Supplier = { id: string; name: string }
type Category = { id: string; metal_id: string; name: string; requires_count: boolean }

export function VaultDetailPage() {
  const { vaultId } = useParams<{ vaultId: string }>()
  const [vault, setVault] = useState<Vault | null>(null)
  const [metals, setMetals] = useState<Metal[]>([])
  const [rows, setRows] = useState<InvRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
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

  const isActive = vault?.status === "active"

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
            <Button
              className="gap-2"
              onClick={() => setAddOpen(true)}
              disabled={!isActive || !activeShift}
              title={!activeShift ? "ابدأ شيفت أولاً لتسجيل أي حركة" : undefined}
            >
              <Plus className="h-4 w-4" />
              قيد دخول
            </Button>
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
        <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
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
                </CardContent>
              </Card>
            )
          })}
            </div>
          )}

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
      return toast.error("فشل تسجيل الحركات")
    }

    // Aggregate by metal+karat then upsert inventory
    const agg = new Map<string, { metalId: string; karat: string; weight: number }>()
    for (const p of prepared) {
      const k = `${p.metalId}__${p.karat}`
      const cur = agg.get(k)
      if (cur) cur.weight += p.weight
      else agg.set(k, { metalId: p.metalId, karat: p.karat, weight: p.weight })
    }
    for (const a of agg.values()) {
      const { data: existing } = await supabase
        .from("vault_inventory")
        .select("id,total_weight")
        .eq("vault_id", vault.id)
        .eq("metal_id", a.metalId)
        .eq("karat", a.karat)
        .maybeSingle()
      if (existing) {
        await supabase
          .from("vault_inventory")
          .update({ total_weight: Number(existing.total_weight) + a.weight })
          .eq("id", existing.id)
      } else {
        await supabase.from("vault_inventory").insert({
          vault_id: vault.id,
          metal_id: a.metalId,
          karat: a.karat,
          total_weight: a.weight,
        })
      }
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
        <div className="flex flex-col gap-4">
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

          <div className="scrollbar-thin flex max-h-[55vh] flex-col gap-3 overflow-y-auto pe-2">
            {entries.map((e, idx) => {
              const cats = categories.filter((c) => c.metal_id === e.metalId)
              const sel = categories.find((c) => c.id === e.categoryId)
              const requiresCount = !!sel?.requires_count
              return (
                <div
                  key={e.key}
                  className="rounded-md border bg-muted/30 p-3 flex flex-col gap-2"
                >
                  <span className="text-xs text-muted-foreground">سطر {idx + 1}</span>
                  <div className="flex items-end gap-2">
                    <div className="flex flex-1 flex-col gap-1.5">
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
                    <div className="flex flex-1 flex-col gap-1.5">
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
