import { supabase } from "@/integrations/supabase/client"
import type { WorkOrderRow } from "@/pages/work-orders"
import { computeWorkOrderContents } from "@/lib/work-order-contents"

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
    .select("work_order_id,from_type,from_id,to_type,to_id,metal_id,karat,category_id,weight,count,created_at")
    .eq("work_order_id", order.id)
  if (error) throw error

  const items = computeWorkOrderContents(mvs ?? [], order.id, "vault", holderId)
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