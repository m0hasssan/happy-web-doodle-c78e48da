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

export async function returnWorkOrderToVault(
  order: WorkOrderRow,
  opts: { shiftId: string; employeeName: string | null; vaultId?: string },
) {
  if (order.current_holder_type !== "section" || !order.current_holder_id) {
    throw new Error("أمر الشغل ليس في حوزة قسم حالياً")
  }
  const sectionId = order.current_holder_id
  const vaultId = opts.vaultId ?? order.from_vault_id
  const { data: mvs, error } = await supabase
    .from("movements")
    .select("work_order_id,from_type,from_id,to_type,to_id,metal_id,karat,category_id,weight,count,created_at")
    .eq("work_order_id", order.id)
  if (error) throw error

  const items = computeWorkOrderContents(mvs ?? [], order.id, "section", sectionId)
  if (items.length === 0) {
    throw new Error("لا توجد أوزان حالياً عند القسم للاسترداد")
  }
  const { error: insErr } = await supabase.from("movements").insert(
    items.map((p) => ({
      from_type: "section",
      from_id: sectionId,
      to_type: "vault",
      to_id: vaultId,
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

export async function cancelWorkOrder(
  order: { id: string; from_vault_id: string; to_section_id: string; status: string },
  opts: { shiftId: string; employeeName: string | null },
) {
  const { data: mvs, error } = await supabase
    .from("movements")
    .select("id,from_type,from_id,to_type,to_id,metal_id,karat,category_id,weight,count")
    .eq("work_order_id", order.id)
  if (error) throw error
  const list = mvs ?? []
  if (list.length === 0) {
    throw new Error("لا توجد حركات للأمر")
  }
  // Eligibility: every movement must be the initial vault→section issuance.
  const eligible = list.every(
    (m) =>
      m.from_type === "vault" &&
      m.from_id === order.from_vault_id &&
      m.to_type === "section" &&
      m.to_id === order.to_section_id,
  )
  if (!eligible) {
    throw new Error("لا يمكن إلغاء أمر الشغل: تم تنفيذ حركات عليه بالفعل")
  }
  // Insert reverse movements section→vault
  const { error: insErr } = await supabase.from("movements").insert(
    list.map((m) => ({
      from_type: "section",
      from_id: order.to_section_id,
      to_type: "vault",
      to_id: order.from_vault_id,
      metal_id: m.metal_id,
      karat: m.karat,
      weight: Number(m.weight),
      category_id: m.category_id,
      count: m.count,
      employee_name: opts.employeeName,
      shift_id: opts.shiftId,
      work_order_id: order.id,
    })),
  )
  if (insErr) throw insErr
  const { error: updErr } = await supabase
    .from("work_orders")
    .update({ status: "cancelled" })
    .eq("id", order.id)
  if (updErr) throw updErr
}