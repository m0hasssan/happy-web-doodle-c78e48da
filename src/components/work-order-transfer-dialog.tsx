import { useEffect, useState } from "react"
import { Plus, Trash2, Info } from "lucide-react"
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
import { computeWorkOrderContents, type WorkOrderMovementLike } from "@/lib/work-order-contents"
import { formatWeight, formatNumber } from "@/lib/number-format"
import { buildCategoryPathMap, getLeafCategoriesForMetal, type CategoryNode } from "@/lib/category-tree"

type Metal = { id: string; name_ar: string }
type Karat = { metal_id: string; karat: string }
type Category = CategoryNode
type InvRow = { metal_id: string; karat: string | null; total_weight: number }
type Place = { id: string; name: string }
type OrderItem = { metal_id: string; karat: string; weight: number; metal_name?: string }

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
  settle = false,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  order: WorkOrderRow
  direction: Direction
  onDone?: () => void
  settle?: boolean
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
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [priorReturns, setPriorReturns] = useState<{ metal_id: string; karat: string; weight: number }[]>([])
  const [allMovements, setAllMovements] = useState<WorkOrderMovementLike[]>([])
  const [sectionKind, setSectionKind] = useState<"manufacturing" | "processing" | null>(null)

  const isReturn = direction === "return-to-vault"
  const fromType: "section" | "vault" = isReturn ? "section" : "vault"
  const toType: "vault" | "section" = isReturn ? "vault" : "section"
  const fromId = order.current_holder_id ?? ""
  const isProcessing = isReturn && sectionKind === "processing"

  useEffect(() => {
    if (!open) return
    setRows([newRow()])
    setDestId(isReturn ? "" : order.to_section_id)
    setAllowedMetalIds(null)
    setSectionKind(null)

    if (isReturn) {
      supabase
        .from("manufacturing_sections")
        .select("kind")
        .eq("id", order.to_section_id)
        .single()
        .then(({ data }) => {
          const k = (data?.kind as string) ?? "manufacturing"
          setSectionKind(k === "processing" ? "processing" : "manufacturing")
        })
    }

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
    // Load this work order's items: net out from vault = original outflow per (metal,karat)
    supabase
      .from("movements")
      .select("work_order_id,metal_id,karat,category_id,weight,count,from_type,from_id,to_type,to_id,created_at")
      .eq("work_order_id", order.id)
      .then(({ data }) => {
        const orig = new Map<string, { metal_id: string; karat: string; weight: number }>()
        const back = new Map<string, { metal_id: string; karat: string; weight: number }>()
        const all = (data ?? []) as Array<{
          work_order_id: string | null; metal_id: string; karat: string | null; category_id: string | null;
          weight: number; count: number | null; from_type: string; from_id: string; to_type: string; to_id: string;
          created_at: string;
        }>
        for (const m of all) {
          if (!m.karat) continue
          const key = `${m.metal_id}__${m.karat}`
          // Original outflow: vault -> section
          if (m.from_type === "vault" && m.to_type === "section") {
            const cur = orig.get(key) ?? { metal_id: m.metal_id, karat: m.karat, weight: 0 }
            cur.weight += Number(m.weight)
            orig.set(key, cur)
          }
          // Prior returns: section -> vault
          if (m.from_type === "section" && m.to_type === "vault") {
            const cur = back.get(key) ?? { metal_id: m.metal_id, karat: m.karat, weight: 0 }
            cur.weight += Number(m.weight)
            back.set(key, cur)
          }
        }
        setOrderItems(Array.from(orig.values()))
        setPriorReturns(Array.from(back.values()))
        setAllMovements(all.map((m) => ({
          work_order_id: m.work_order_id, from_type: m.from_type, from_id: m.from_id,
          to_type: m.to_type, to_id: m.to_id, metal_id: m.metal_id, karat: m.karat,
          category_id: m.category_id, weight: Number(m.weight), count: m.count,
          created_at: m.created_at,
        })))
      })
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
  }, [open, isReturn, fromType, fromId, order.id, order.to_section_id])

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

  // Restrict metals/karats to those present in the work order when returning to vault
  const orderMetalIds = new Set(orderItems.map((o) => o.metal_id))
  const orderKaratsByMetal = new Map<string, Set<string>>()
  for (const o of orderItems) {
    if (!orderKaratsByMetal.has(o.metal_id)) orderKaratsByMetal.set(o.metal_id, new Set())
    orderKaratsByMetal.get(o.metal_id)!.add(o.karat)
  }
  const filteredMetals = isReturn ? metals.filter((m) => orderMetalIds.has(m.id)) : metals
  const allowedKarats = (metalId: string) =>
    isReturn && !isProcessing
      ? karats.filter((k) => k.metal_id === metalId && orderKaratsByMetal.get(metalId)?.has(k.karat))
      : karats.filter((k) => k.metal_id === metalId)

  // Pure ratio per karat (999 treated as 1.0)
  const pureRatio = (karat: string | null | undefined) =>
    !karat ? 1 : karat === "999" ? 1 : Number(karat) / 1000

  // Live return % per (metal,karat) including current draft + prior returns
  const draftSums = new Map<string, number>()
  for (const r of rows) {
    if (!r.metalId || !r.karat) continue
    const w = Number(r.weight)
    if (!w || w <= 0) continue
    const key = `${r.metalId}__${r.karat}`
    draftSums.set(key, (draftSums.get(key) ?? 0) + w)
  }
  const returnSummary = isReturn && !isProcessing
    ? orderItems.map((o) => {
        const key = `${o.metal_id}__${o.karat}`
        const draft = draftSums.get(key) ?? 0
        // Original = the very first contiguous vault->section batch only
        // (before any section->vault return happened for this work order).
        const sorted = allMovements
          .slice()
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        let originalIssued = 0
        for (const m of sorted) {
          if (m.metal_id !== o.metal_id || (m.karat ?? "") !== o.karat) continue
          if (m.from_type === "section" && m.to_type === "vault") break
          if (m.from_type === "vault" && m.to_type === "section") {
            originalIssued += Number(m.weight)
          }
        }
        const overallPct = originalIssued > 0 ? (draft / originalIssued) * 100 : 0
        // Current operation: denominator is what is currently held at the
        // section right now (the last contiguous batch sent there).
        const curHeldItems = computeWorkOrderContents(allMovements, order.id, "section", fromId)
        const curHeld = curHeldItems
          .filter((c) => c.metal_id === o.metal_id && (c.karat ?? "") === o.karat)
          .reduce((s, c) => s + c.weight, 0)
        const currentPct = curHeld > 0 ? (draft / curHeld) * 100 : 0
        const metalName = metals.find((m) => m.id === o.metal_id)?.name_ar ?? ""
        return {
          ...o,
          metal_name: metalName,
          draft,
          currentIssued: curHeld,
          currentPct,
          overallIssued: originalIssued,
          overallPct,
        }
      })
    : []

  // Pure-based summary for processing returns (aggregated per metal)
  const processingSummary = isProcessing
    ? Array.from(orderMetalIds).map((mid) => {
        const issuedPure = orderItems
          .filter((o) => o.metal_id === mid)
          .reduce((s, o) => s + Number(o.weight) * pureRatio(o.karat), 0)
        const priorPure = priorReturns
          .filter((p) => p.metal_id === mid)
          .reduce((s, p) => s + Number(p.weight) * pureRatio(p.karat), 0)
        const draftPure = rows
          .filter((r) => r.metalId === mid && r.karat && Number(r.weight) > 0)
          .reduce((s, r) => s + Number(r.weight) * pureRatio(r.karat), 0)
        const returnedPure = priorPure + draftPure
        const pct = issuedPure > 0 ? (returnedPure / issuedPure) * 100 : 0
        const metalName = metals.find((m) => m.id === mid)?.name_ar ?? ""
        return { metal_id: mid, metal_name: metalName, issuedPure, returnedPure, pct }
      })
    : []

  const submit = async () => {
    if (!activeShift) return toast.error("ابدأ شيفت أولاً")
    if (!destId) return toast.error(isReturn ? "اختر الخزنة" : "القسم غير محدد")
    if (rows.length === 0) return toast.error("أضف سطراً واحداً على الأقل")

    type Prepared = {
      metalId: string; karat: string; weight: number; categoryId: string | null; count: number | null
    }
    const prepared: Prepared[] = []
    const totalsKey = new Map<string, number>()
    // For processing returns: validate against total available pure per metal
    const purePerMetal = new Map<string, number>()
    if (isProcessing) {
      for (const inv of holderInventory) {
        purePerMetal.set(
          inv.metal_id,
          (purePerMetal.get(inv.metal_id) ?? 0) + Number(inv.total_weight) * pureRatio(inv.karat),
        )
      }
    }
    const usedPurePerMetal = new Map<string, number>()
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
      if (isProcessing) {
        const need = w * pureRatio(e.karat)
        const used = (usedPurePerMetal.get(e.metalId) ?? 0) + need
        const avail = purePerMetal.get(e.metalId) ?? 0
        if (used > avail + 0.0001) {
          const mn = metals.find((x) => x.id === e.metalId)?.name_ar ?? ""
          return toast.error(
            `السطر ${idx}: المتاح بالنقاوة لـ${mn} ${formatWeight(avail)} جم فقط`,
          )
        }
        usedPurePerMetal.set(e.metalId, used)
      } else {
        const avail = availableFor(e.metalId, e.karat)
        const k = `${e.metalId}__${e.karat}`
        const used = (totalsKey.get(k) ?? 0) + w
        if (used > avail + 0.0001)
          return toast.error(`السطر ${idx}: المتاح في الموقع الحالي ${avail} جم فقط`)
        totalsKey.set(k, used)
      }
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
    if (isProcessing) {
      const { data: shrink, error: rerr } = await supabase.rpc("process_section_workorder_return", {
        p_work_order_id: order.id,
        p_dest_vault_id: destId,
        p_shift_id: activeShift.id,
        p_employee_name: displayName,
        p_items: prepared.map((p) => ({
          metal_id: p.metalId,
          karat: p.karat,
          weight: p.weight,
          category_id: p.categoryId,
          count: p.count,
        })),
      })
      if (rerr) {
        setSaving(false)
        return toast.error(rerr.message)
      }
      if (settle) {
        const { error: uerr } = await supabase
          .from("work_orders")
          .update({ status: "delivered" })
          .eq("id", order.id)
        if (uerr) {
          setSaving(false)
          return toast.error("تم الاسترداد ولكن فشل قفل أمر الشغل: " + uerr.message)
        }
      }
      const arr = (shrink ?? []) as Array<{ missing: number; pure_999: number }>
      const totalPure = arr.reduce((s, x) => s + Number(x.pure_999), 0)
      if (settle) {
        toast.success("تمت تسوية أمر الشغل وتحويل الأوزان للخزنة كرصيد متاح")
      } else if (arr.length > 0) {
        toast.success(
          `تم الاسترداد · خسية ${formatWeight(totalPure)} جم 999 عند القسم`,
        )
      } else {
        toast.success("تم استرداد أمر الشغل للخزنة")
      }
      setSaving(false)
      onOpenChange(false)
      onDone?.()
      return
    }
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
    if (error) {
      setSaving(false)
      return toast.error(error.message)
    }
    if (isReturn) {
      const { data: shrink, error: serr } = await supabase.rpc("work_order_apply_shrinkage", {
        p_work_order_id: order.id,
      })
      if (serr) {
        setSaving(false)
        return toast.error("تم الاسترداد ولكن فشل تطبيق التحييف: " + serr.message)
      }
      if (settle) {
        const { error: uerr } = await supabase
          .from("work_orders")
          .update({ status: "delivered" })
          .eq("id", order.id)
        if (uerr) {
          setSaving(false)
          return toast.error("تم الاسترداد ولكن فشل قفل أمر الشغل: " + uerr.message)
        }
      }
      const arr = (shrink ?? []) as Array<{ missing: number; pure_999: number }>
      const totalMissing = arr.reduce((s, x) => s + Number(x.missing), 0)
      const totalPure = arr.reduce((s, x) => s + Number(x.pure_999), 0)
      if (settle) {
        toast.success("تمت تسوية أمر الشغل وتحويل الأوزان للخزنة كرصيد متاح")
      } else if (arr.length > 0) {
        toast.success(
          `تم الاسترداد · تحييف ${formatWeight(totalMissing)} جم → ${formatWeight(totalPure)} جم 999 عند القسم`,
        )
      } else {
        toast.success("تم استرداد أمر الشغل للخزنة")
      }
    } else {
      toast.success("تمت إعادة الأمر للقسم")
    }
    setSaving(false)
    onOpenChange(false)
    onDone?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {settle
              ? `تسوية وقفل أمر شغل ${order.code}`
              : isReturn
                ? `استرداد أمر شغل ${order.code} للخزنة`
                : `إعادة أمر شغل ${order.code} للقسم`}
          </DialogTitle>
          <DialogDescription>
            {settle
              ? "ادخل الأصناف النهائية المستردة. سيتم قفل أمر الشغل وإضافة الأوزان للخزنة كرصيد متاح."
              : isReturn
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

          {isReturn && returnSummary.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-md border bg-muted/40 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Info className="h-3.5 w-3.5" /> نسبة الاسترداد للعملية الحالية
              </div>
              <div className="flex flex-col gap-1">
                {returnSummary.map((s) => {
                  const tone =
                    s.currentPct >= 99 ? "text-primary" : s.currentPct >= 90 ? "text-foreground" : "text-destructive"
                  return (
                    <div key={`cur__${s.metal_id}__${s.karat}`} className="flex items-center justify-between gap-2">
                      <span>
                        {s.metal_name} عيار <span dir="ltr">{s.karat}</span> — حالياً عند القسم{" "}
                        <span className="tabular-nums">{formatWeight(s.currentIssued)}</span> جم · خسية{" "}
                        <span className="tabular-nums">{formatWeight(Math.max(0, s.currentIssued - s.draft))}</span> جم
                      </span>
                      <span className={`font-semibold tabular-nums ${tone}`}>
                        {formatNumber(s.currentPct, { decimals: 2 })}%
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
                <Info className="h-3.5 w-3.5" /> إجمالي الاسترداد من الوزن الأصلي
              </div>
              <div className="flex flex-col gap-1">
                {returnSummary.map((s) => {
                  const tone =
                    s.overallPct >= 99 ? "text-primary" : s.overallPct >= 90 ? "text-foreground" : "text-destructive"
                  return (
                    <div key={`all__${s.metal_id}__${s.karat}`} className="flex items-center justify-between gap-2">
                      <span>
                        {s.metal_name} عيار <span dir="ltr">{s.karat}</span> — الأصلي{" "}
                        <span className="tabular-nums">{formatWeight(s.overallIssued)}</span> جم · إجمالي الخسية{" "}
                        <span className="tabular-nums">{formatWeight(Math.max(0, s.overallIssued - s.draft))}</span> جم
                      </span>
                      <span className={`font-semibold tabular-nums ${tone}`}>
                        {formatNumber(s.overallPct, { decimals: 2 })}%
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="text-muted-foreground">
                الجرامات الناقصة هتتحوّل لعيار 999 (بالنقاوة) وتتسجل عند القسم كخسية تلقائياً بعد الحفظ.
              </div>
            </div>
          )}

          {isProcessing && processingSummary.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-md border bg-muted/40 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Info className="h-3.5 w-3.5" /> ملخص نسبة الاسترداد بالنقاوة (قسم معالجة)
              </div>
              <div className="flex flex-col gap-1">
                {processingSummary.map((s) => {
                  const tone =
                    s.pct >= 99 ? "text-primary" : s.pct >= 90 ? "text-foreground" : "text-destructive"
                  return (
                    <div key={s.metal_id} className="flex items-center justify-between gap-2">
                      <span>
                        {s.metal_name} — خرج بالنقاوة{" "}
                        <span className="tabular-nums">
                          {formatWeight(s.issuedPure)}
                        </span>{" "}
                        جم · مسترد بالنقاوة{" "}
                        <span className="tabular-nums">
                          {formatWeight(s.returnedPure)}
                        </span>{" "}
                        جم
                      </span>
                      <span className={`font-semibold tabular-nums ${tone}`}>
                        {formatNumber(s.pct, { decimals: 2 })}%
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="text-muted-foreground">
                مسموح تغيير العيار عند الخروج. الناقص بالنقاوة يتسجّل كخسية بعيار 999 عند القسم.
              </div>
            </div>
          )}

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
                        options={filteredMetals.map((m) => ({ value: m.id, label: m.name_ar, search: m.name_ar }))}
                      />
                    </div>
                    <div className="flex w-24 flex-col gap-1.5">
                      <Label className="text-xs">العيار</Label>
                      <SearchableSelect
                        value={e.karat}
                        onValueChange={(v) => update(e.key, { karat: v })}
                        placeholder="العيار"
                        options={allowedKarats(e.metalId).map((k) => ({
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