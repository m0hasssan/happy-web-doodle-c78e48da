/**
 * Convert a weight from a source karat to a target karat using purity ratios.
 * Karats are stored as numeric strings (e.g. "999", "875"). Purity = karat/1000.
 *
 *   convertedWeight = weight * (sourceKarat / targetKarat)
 *
 * If either karat is missing or not a positive number, returns the original
 * weight (caller should treat metals/items without karats as already at the
 * primary karat).
 */
export function convertWeightToKarat(
  weight: number,
  sourceKarat: string | null | undefined,
  targetKarat: string | null | undefined,
): number {
  const w = Number(weight)
  if (!Number.isFinite(w)) return 0
  const src = Number(sourceKarat)
  const tgt = Number(targetKarat)
  if (!Number.isFinite(src) || src <= 0) return w
  if (!Number.isFinite(tgt) || tgt <= 0) return w
  return (w * src) / tgt
}

export type WeightLike = {
  weight: number | string
  karat: string | null | undefined
}

/** Sum a set of weights (for a single metal) converted to its primary karat. */
export function sumAtPrimaryKarat(
  items: WeightLike[],
  primaryKarat: string | null | undefined,
): number {
  let total = 0
  for (const it of items) {
    total += convertWeightToKarat(Number(it.weight), it.karat, primaryKarat)
  }
  return total
}