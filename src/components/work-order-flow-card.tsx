import { useEffect, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, MinusCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/integrations/supabase/client"
import { metalClasses } from "@/lib/metal-colors"
import { formatWeight } from "@/lib/number-format"
import type { MovementRow } from "@/pages/movements"
import type { WorkOrderRow } from "@/pages/work-orders"

type CategoryBreakdown = {
  category_name: string | null
  weight: number
  count: number | null
}

type AggItem = {
  key: string
  metal_id: string
  metal_name: string
  metal_color: string
  karat: string | null
  weight: number
  count: number | null
  categories: CategoryBreakdown[]
}

type ShrinkRow = {
  metal_id: string
  karat: string | null
  pure_999_weight: number
}

function aggregate(
  movements: MovementRow[],
  predicate: (m: MovementRow) => boolean,
): AggItem[] {
  const map = new Map<string, AggItem>()
  for (const m of movements) {
    if (!predicate(m)) continue
    const key = `${m.metal_id}__${m.karat ?? ""}`
    const cur =
      map.get(key) ??
      ({
        key,
        metal_id: m.metal_id,
        metal_name: m.metal_name,
        metal_color: m.metal_color,
        karat: m.karat,
        weight: 0,
        count: null,
        categories: [],
      } as AggItem)
    cur.weight += Number(m.weight)
    if (m.count != null) cur.count = (cur.count ?? 0) + Number(m.count)
    const catKey = m.category_name ?? ""
    const existingCat = cur.categories.find((c) => (c.category_name ?? "") === catKey)
    if (existingCat) {
      existingCat.weight += Number(m.weight)
      if (m.count != null) existingCat.count = (existingCat.count ?? 0) + Number(m.count)
    } else {
      cur.categories.push({
        category_name: m.category_name ?? null,
        weight: Number(m.weight),
        count: m.count != null ? Number(m.count) : null,
      })
    }
    map.set(key, cur)
  }
  return Array.from(map.values()).filter((x) => x.weight > 0.0001)
}

function ItemList({ items, emptyText }: { items: AggItem[]; emptyText: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
        {emptyText}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((m) => {
        const cls = metalClasses(m.metal_color)
        return (
          <Card key={m.key} size="sm" className={`${cls.bg} ${cls.border} border`}>
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className={`text-xs ${cls.text}`}>{m.metal_name}</span>
                {m.karat && (
                  <Badge variant="outline" className={`${cls.text} ${cls.border}`}>
                    عيار {m.karat}
                  </Badge>
                )}
              </div>
              <div className={`text-xl font-bold tabular-nums ${cls.text}`}>
                {formatWeight(m.weight)}
                <span className="ms-1 text-xs font-normal opacity-70">جم</span>
              </div>
              {m.categories.some((c) => c.category_name || (c.count != null && c.count > 0)) && (
                <div className={`mt-1 flex flex-col gap-0.5 border-t pt-1 ${cls.border}`}>
                  {m.categories.map((c, i) => (
                    <div
                      key={`${c.category_name ?? ""}-${i}`}
                      className={`flex items-center justify-between gap-2 text-xs ${cls.text} opacity-80`}
                    >
                      <span>{c.category_name ?? "—"}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        <span>{formatWeight(c.weight)} جم</span>
                        {c.count != null && c.count > 0 && <span>× {c.count}</span>}
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
  )
}

export function WorkOrderFlowCard({
  order,
  movements,
}: {
  order: WorkOrderRow
  movements: MovementRow[]
}) {
  const [shrinkage, setShrinkage] = useState<ShrinkRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("work_order_shrinkage")
        .select("metal_id,karat,pure_999_weight")
        .eq("work_order_id", order.id)
      if (!cancelled) setShrinkage((data ?? []) as ShrinkRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [order.id])

  const sectionId = order.to_section_id
  const incoming = aggregate(
    movements,
    (m) => m.to_type === "section" && m.to_id === sectionId,
  )
  const outgoing = aggregate(
    movements,
    (m) => m.from_type === "section" && m.from_id === sectionId,
  )

  // Build a metal lookup from movements so shrinkage gets the right name/color.
  const metalLookup = new Map<string, { name: string; color: string }>()
  for (const m of movements) {
    if (!metalLookup.has(m.metal_id)) {
      metalLookup.set(m.metal_id, { name: m.metal_name, color: m.metal_color })
    }
  }

  const shrinkAgg: AggItem[] = (() => {
    if (!shrinkage) return []
    const map = new Map<string, AggItem>()
    for (const s of shrinkage) {
      const meta = metalLookup.get(s.metal_id) ?? { name: "-", color: "" }
      const key = `${s.metal_id}__999`
      const cur =
        map.get(key) ??
        ({
          key,
          metal_id: s.metal_id,
          metal_name: meta.name,
          metal_color: meta.color,
          karat: "999",
          category_name: null,
          weight: 0,
          count: null,
        } as AggItem)
      cur.weight += Number(s.pure_999_weight)
      map.set(key, cur)
    }
    return Array.from(map.values()).filter((x) => x.weight > 0.0001)
  })()

  const isSettled = order.status === "delivered"

  return (
    <Card>
      <CardContent className="grid gap-4 py-4 md:grid-cols-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">الداخل</h3>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ArrowDownToLine className="h-3.5 w-3.5" />
            </div>
          </div>
          <ItemList items={incoming} emptyText="لم يدخل بعد" />
        </div>

        <div className="flex flex-col gap-3 md:border-x md:px-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">الخارج</h3>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ArrowUpFromLine className="h-3.5 w-3.5" />
            </div>
          </div>
          <ItemList
            items={outgoing}
            emptyText={isSettled ? "لم يخرج شيء" : "لم يخرج بعد"}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">الخسية (999)</h3>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <MinusCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <ItemList
            items={shrinkAgg}
            emptyText={isSettled ? "لا توجد خسية" : "لا يوجد خسية بعد"}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default WorkOrderFlowCard