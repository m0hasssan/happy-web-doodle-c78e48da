import type { MovementRow } from "@/pages/movements"

/**
 * Compute the current contents of a work order at a given holder by walking
 * the WO's movements chronologically. Items only start accumulating once the
 * WO first arrives at this holder; subsequent outflows from the holder are
 * subtracted, and later inflows added back. This avoids the bug of treating
 * the original "issued from vault" movement as if it had reduced the WO's
 * inventory at that vault.
 *
 * Aggregates per metal+karat+category. Returned items have weight > 0.
 */
export type WoContentItem = {
  key: string
  metal_id: string
  metal_name: string
  metal_color: string
  karat: string | null
  category_id: string | null
  category_name: string | null
  weight: number
  count: number | null
}

export function computeWorkOrderContents(
  movements: MovementRow[],
  workOrderId: string,
  holderType: "vault" | "section" | null,
  holderId: string | null,
): WoContentItem[] {
  if (!holderType || !holderId) return []
  const items = movements
    .filter((m) => m.work_order_id === workOrderId)
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const agg = new Map<string, WoContentItem>()
  let started = false
  for (const m of items) {
    const isIn = m.to_type === holderType && m.to_id === holderId
    const isOut = m.from_type === holderType && m.from_id === holderId
    if (!isIn && !isOut) continue
    if (isIn) started = true
    if (!started) continue
    const sign = isIn ? 1 : -1
    const key = `${m.metal_id}__${m.karat ?? ""}__${m.category_id ?? ""}`
    const cur =
      agg.get(key) ??
      ({
        key,
        metal_id: m.metal_id,
        metal_name: m.metal_name,
        metal_color: m.metal_color,
        karat: m.karat,
        category_id: m.category_id,
        category_name: m.category_name,
        weight: 0,
        count: null,
      } as WoContentItem)
    cur.weight += sign * Number(m.weight)
    if (m.count != null) cur.count = (cur.count ?? 0) + sign * Number(m.count)
    agg.set(key, cur)
  }
  return Array.from(agg.values()).filter((x) => x.weight > 0.0001)
}