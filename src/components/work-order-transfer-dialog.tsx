import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useAuth } from "@/contexts/auth-context"
import { useActiveShift } from "@/hooks/use-active-shift"
import type { WorkOrderRow } from "@/pages/work-orders"

type Metal = { id: string; name_ar: string }
type Karat = { metal_id: string; karat: string }
type Category = { id: string; metal_id: string; name: string; requires_count: boolean }
type InvRow = { metal_id: string; karat: string | null; total_weight: number }
type Place = { id: string; name: string }

type Direction = "return-to-vault" | "send-to-section"

type Row = {
  key: string
  metalId: string
  karat: string
  categoryId: string
  weight: string
  count: string
}

const newRow = (): Row => ({
  key: crypto.randomUUID(),
  metalId: "",
  karat: "",
  categoryId: "",
  weight: "",
  count: "",
})

export function WorkOrderTransferDialog({
  open,
  onOpenChange,
  order,
  direction,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  order: WorkOrderRow
  direction: Direction
  onDone?: () => void
}) {
  const { displayName } = useAuth()
  const { shift: activeShift } = useActiveShift()
  const [vaults, setVaults] = useState<Place[]>([])
  const [destId, setDestId] = useState<string>("")
  const [metals, setMetals] = useState<Metal[]>([])
  const [karats, setKarats] = useState<Karat[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allowedMetalIds, setAllowedMetalIds] = useState<Set<string> | null>(null)
  const [holderInventory, setHolderInventory] = useState<InvRow[]>([])
  const [rows, setRows] = useState<Row[]>([newRow()])
  const [saving, setSaving] = useState(false)

  const isReturn = direction === "return-to-vault"
  const fromType: "section" | "vault" = isReturn ? "section" : "vault"
  const toType: "vault" | "section" = isReturn ? "vault" : "section"
  const fromId = order.current_holder_id ?? ""

  useEffect(() => {
    if (!open) return
    setRows([newRow()])
    setDestId(isReturn ? "" : order.to_section_id)
    setAllowedMetalIds(null)

    supabase.from("metals").select("id,name_ar").eq("enabled", true).then(({ data }) => {
      setMetals((data ?? []) as Metal[])
    })
    supabase.from("metal_karats").select("metal_id,karat").then(({ data }) => {
      setKarats((data ?? []) as Karat[])
    })
    supabase.from("metal_categories").select("id,metal_id,name,requires_count").order("name").then(({ data }) => {
      setCategories((data ?? []) as Category[])
    })
    if (isReturn) {
      supabase.from("vaults").select("id,name").eq("status", "active").order("name").then(({ data }) => {
        setVaults((data ?? []) as Place[])
      })
    }
    // load current holder inventory to validate available stock
    if (fromType === "section") {
      supabase
        .from("section_inventory")
        .select("metal_id,karat,total_weight")
        .eq("section_id", fromId)
        .then(({ data }) => setHolderInventory((data ?? []) as InvRow[]))
    } else {
      supabase
        .from("vault_inventory")
        .select("metal_id,karat,total_weight")
        .eq("vault_id", fromId)
        .then(({ data }) => setHolderInventory((data ?? []) as InvRow[]))
    }
  }, [open, isReturn, fromType, fromId, order.to_section_id])

  // load destination allowed metals
  useEffect(() => {
    if (!open || !destId) {
      setAllowedMetalIds(null)
      return
    }
    if (toType === "vault") {
      supabase.from("vault_metals").select("metal_id").eq("vault_id", destId).then(({ data }) =>
        setAllowedMetalIds(new Set((data ?? []).map((x) => x.metal_id as string))),
      )
    } else {
      supabase.from("section_metals").select("metal_id").eq("section_id", destId).then(({ data }) =>
        setAllowedMetalIds(new Set((data ?? []).map((x) => x.metal_id as string))),
      )
    }
  }, [open, destId, toType])

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        const next = { ...r, ...patch }
        if (patch.metalId !== undefined && patch.metalId !== r.metalId) {
          next.karat = ""
          next.categoryId = ""
          next.count = ""
        }
        if (patch.categoryId !== undefined && patch.categoryId !== r.categoryId) {
          next.count = ""
        }
        return next
      }),
    )

  const availableFor = (metalId: string, karat: string) =>
    Number(holderInventory.find((r) => r.metal_id === metalId && (r.karat ?? "") === karat)?.total_weight ?? 0)

  const submit = async () => {
    if (!activeShift) return toast.error("ابدأ شيفت أولاً")
    if (!destId) return toast.error(isReturn ? "اختر الخزنة" : "القسم غير محدد")
    if (rows.length === 0) return toast.error("أضف سطراً واحداً على الأقل")

    type Prepared = {
      metalId: string; karat: string; weight: number; categoryId: string | null; count: number | null
    }
    const prepared: Prepared[] = []
    const totalsKey = new Map<string, number>()
    for (let i = 0; i < rows.length; i++) {
      const e = rows[i]
      const idx = i + 1
      if (!e.metalId) return toast.error(`السطر ${idx}: اختر المعدن`)
      if (!e.karat.trim()) return toast.error(`السطر ${idx}: اختر العيار`)
      if (allowedMetalIds && !allowedMetalIds.has(e.metalId)) {
        const m = metals.find((x) => x.id === e.metalId)?.name_ar ?? ""
        return toast.error(`السطر ${idx}: الوجهة لا تقبل ${m}`)
      }
      const w = Number(e.weight)
      if (!w || w <= 0) return toast.error(`السطر ${idx}: ادخل وزناً صحيحاً`)
      const avail = availableFor(e.metalId, e.karat)
      const k = `${e.metalId}__${e.karat}`
      const used = (totalsKey.get(k) ?? 0) + w
      if (used > avail + 0.0001)
        return toast.error(`السطر ${idx}: المتاح في الموقع الحالي ${avail} جم فقط`)
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
    const { error } = await supabase.from("movements").insert(
      prepared.map((p) => ({
        from_type: fromType,
        from_id: fromId,
        to_type: toType,
        to_id: destId,
        metal_id: p.metalId,
        karat: p.karat,
        weight: p.weight,
        employee_name: displayName,
        shift_id: activeShift.id,
        category_id: p.categoryId,
        count: p.count,
        work_order_id: order.id,
      })),
    )
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(isReturn ? "تم استرداد أمر الشغل للخزنة" : "تمت إعادة الأمر للقسم")
    onOpenChange(false)
    onDone?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isReturn ? `استرداد أمر شغل ${order.code} للخزنة` : `إعادة أمر شغل ${order.code} للقسم`}
          </DialogTitle>
          <DialogDescription>
            {isReturn
              ? "ادخل الأصناف الفعلية المستردة من القسم (قد تختلف عن الأصلية بسبب الخسسيات أو التشغيل)."
              : `إعادة الأصناف الموجودة حالياً في الخزنة إلى قسم «${order.section_name}».`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          {isReturn && (
            <div className="flex flex-col gap-2">
              <Label>الخزنة المستلمة</Label>
              <SearchableSelect
                value={destId}
                onValueChange={setDestId}
                placeholder="اختر الخزنة..."
                options={vaults.map((v) => ({ value: v.id, label: v.name, search: v.name }))}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>الأصناف</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setRows((p) => [...p, newRow()])}>
              <Plus className="h-4 w-4" /> إضافة سطر
            </Button>
          </div>

          <div className="scrollbar-thin flex max-h-[55vh] flex-col gap-3 overflow-y-auto overflow-x-auto pe-2">
            {rows.map((e, idx) => {
              const cats = categories.filter((c) => c.metal_id === e.metalId)
              const sel = categories.find((c) => c.id === e.categoryId)
              const requiresCount = !!sel?.requires_count
              return (
                <div key={e.key} className="flex w-max min-w-full flex-col gap-2 rounded-md border bg-muted/30 p-3">
                  <span className="text-xs text-muted-foreground">سطر {idx + 1}</span>
                  <div className="flex items-end gap-2">
                    <div className="flex w-40 flex-col gap-1.5">
                      <Label className="text-xs">المعدن</Label>
                      <SearchableSelect
                        value={e.metalId}
                        onValueChange={(v) => update(e.key, { metalId: v })}
                        placeholder="المعدن"
                        options={metals.map((m) => ({ value: m.id, label: m.name_ar, search: m.name_ar }))}
                      />
                    </div>
                    <div className="flex w-24 flex-col gap-1.5">
                      <Label className="text-xs">العيار</Label>
                      <SearchableSelect
                        value={e.karat}
                        onValueChange={(v) => update(e.key, { karat: v })}
                        placeholder="العيار"
                        options={karats.filter((k) => k.metal_id === e.metalId).map((k) => ({
                          value: k.karat, label: k.karat, search: k.karat, dir: "ltr" as const,
                        }))}
                      />
                    </div>
                    <div className="flex w-40 flex-col gap-1.5">
                      <Label className="text-xs">التصنيف</Label>
                      <SearchableSelect
                        value={e.categoryId}
                        onValueChange={(v) => update(e.key, { categoryId: v })}
                        disabled={cats.length === 0}
                        placeholder={cats.length === 0 ? "—" : "التصنيف"}
                        options={cats.map((c) => ({ value: c.id, label: c.name, search: c.name }))}
                      />
                    </div>
                    <div className="flex w-28 flex-col gap-1.5">
                      <Label className="text-xs">الوزن (جم)</Label>
                      <Input
                        type="number" step="0.001" min="0"
                        value={e.weight}
                        onChange={(ev) => update(e.key, { weight: ev.target.value })}
                        placeholder="0.000" dir="ltr"
                      />
                    </div>
                    <div className="flex w-20 flex-col gap-1.5">
                      <Label className="text-xs">العدد</Label>
                      <Input
                        type="number" step="1" min="1"
                        value={e.count}
                        onChange={(ev) => update(e.key, { count: ev.target.value })}
                        placeholder="—" dir="ltr" disabled={!requiresCount}
                      />
                    </div>
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== e.key)))}
                      disabled={rows.length === 1}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default WorkOrderTransferDialog