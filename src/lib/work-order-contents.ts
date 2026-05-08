/**
 * Compute the current contents of a work order at a given holder from the
 * latest holder phase only. A work order can come back to the same section
 * after being transformed in the vault, so old phases must not leak into the
 * current contents (example: 1000 ingots -> 995 ingots + 5 scrap).
 *
 * Aggregates per metal+karat+category. Returned items have weight > 0.
 */
export type WorkOrderMovementLike = {
  work_order_id: string | null
  from_type: string
  from_id: string
  to_type: string
  to_id: string
  metal_id: string
  metal_name?: string
  metal_color?: string
  karat: string | null
  category_id: string | null
  category_name?: string | null
  weight: number
  count?: number | null
  created_at: string
}

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
  movements: WorkOrderMovementLike[],
  workOrderId: string,
  holderType: "vault" | "section" | null,
  holderId: string | null,
): WoContentItem[] {
  if (!holderType || !holderId) return []
  const items = movements
    .filter((m) => m.work_order_id === workOrderId)
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  let startIndex = -1
  for (let i = items.length - 1; i >= 0; i--) {
    const m = items[i]
    if (m.to_type === holderType && m.to_id === holderId) {
      startIndex = i
      while (
        startIndex > 0 &&
        items[startIndex - 1].to_type === holderType &&
        items[startIndex - 1].to_id === holderId
      ) {
        startIndex--
      }
      break
    }
  }
  if (startIndex === -1) return []

  const agg = new Map<string, WoContentItem>()
  for (const m of items.slice(startIndex)) {
    const isIn = m.to_type === holderType && m.to_id === holderId
    const isOut = m.from_type === holderType && m.from_id === holderId
    if (!isIn && !isOut) continue
    const sign = isIn ? 1 : -1
    const key = `${m.metal_id}__${m.karat ?? ""}__${m.category_id ?? ""}`
    const cur =
      agg.get(key) ??
      ({
        key,
        metal_id: m.metal_id,
        metal_name: m.metal_name ?? "-",
        metal_color: m.metal_color ?? "",
        karat: m.karat,
        category_id: m.category_id,
        category_name: m.category_name ?? null,
        weight: 0,
        count: null,
      } as WoContentItem)
    cur.weight += sign * Number(m.weight)
    if (m.count != null) cur.count = (cur.count ?? 0) + sign * Number(m.count)
    agg.set(key, cur)
  }
  return Array.from(agg.values()).filter((x) => x.weight > 0.0001)
}