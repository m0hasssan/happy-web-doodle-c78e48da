import { supabase } from "@/integrations/supabase/client"
import type { WorkOrderRow } from "@/pages/work-orders"

export async function sendWorkOrderBackToSection(
  order: WorkOrderRow,
  opts: { shiftId: string; employeeName: string | null },
) {
  if (order.current_holder_type !== "vault" || !order.current_holder_id) {
    throw new Error("أمر الشغل ليس في حوزة خزنة حالياً")
  }
  const holderId = order.current_holder_id
  const { data: mvs, error } = await supabase
    .from("movements")
    .select("metal_id,karat,category_id,weight,count,from_id,to_id")
    .eq("work_order_id", order.id)
  if (error) throw error

  type Agg = {
    metal_id: string
    karat: string | null
    category_id: string | null
    weight: number
    count: number | null
  }
  const agg = new Map<string, Agg>()
  for (const m of (mvs ?? []) as Array<{
    metal_id: string
    karat: string | null
    category_id: string | null
    weight: number
    count: number | null
    from_id: string
    to_id: string
  }>) {
    const sign = m.to_id === holderId ? 1 : m.from_id === holderId ? -1 : 0
    if (!sign) continue
    const key = `${m.metal_id}__${m.karat ?? ""}__${m.category_id ?? ""}`
    const cur =
      agg.get(key) ?? {
        metal_id: m.metal_id,
        karat: m.karat,
        category_id: m.category_id,
        weight: 0,
        count: null as number | null,
      }
    cur.weight += sign * Number(m.weight)
    if (m.count != null) cur.count = (cur.count ?? 0) + sign * Number(m.count)
    agg.set(key, cur)
  }
  const items = Array.from(agg.values()).filter((x) => x.weight > 0.0001)
  if (items.length === 0) {
    throw new Error("لا توجد أوزان مستردة للإرجاع")
  }
  const { error: insErr } = await supabase.from("movements").insert(
    items.map((p) => ({
      from_type: "vault",
      from_id: holderId,
      to_type: "section",
      to_id: order.to_section_id,
      metal_id: p.metal_id,
      karat: p.karat,
      weight: p.weight,
      category_id: p.category_id,
      count: p.count,
      employee_name: opts.employeeName,
      shift_id: opts.shiftId,
      work_order_id: order.id,
    })),
  )
  if (insErr) throw insErr
}