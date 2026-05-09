export type CategoryNode = {
  id: string
  metal_id: string
  name: string
  requires_count: boolean
  parent_id: string | null
  sort_order?: number
}

export const CATEGORY_PATH_SEP = " ▸ "

/** Build a Map<id, fullPath> like "سبائك ▸ بلدي" */
export function buildCategoryPathMap(cats: CategoryNode[]): Map<string, string> {
  const byId = new Map(cats.map((c) => [c.id, c]))
  const cache = new Map<string, string>()
  const get = (id: string): string => {
    const cached = cache.get(id)
    if (cached !== undefined) return cached
    const c = byId.get(id)
    if (!c) return ""
    const path = c.parent_id
      ? `${get(c.parent_id)}${CATEGORY_PATH_SEP}${c.name}`
      : c.name
    cache.set(id, path)
    return path
  }
  for (const c of cats) get(c.id)
  return cache
}

export function isLeafCategory(catId: string, cats: CategoryNode[]): boolean {
  return !cats.some((c) => c.parent_id === catId)
}

/** Returns leaf categories for a given metal (categories with no children) */
export function getLeafCategoriesForMetal(
  metalId: string,
  cats: CategoryNode[],
): CategoryNode[] {
  const childIds = new Set(cats.filter((c) => c.parent_id).map((c) => c.parent_id as string))
  return cats.filter((c) => c.metal_id === metalId && !childIds.has(c.id))
}

/** Whether a metal has any category at all */
export function metalHasCategories(metalId: string, cats: CategoryNode[]): boolean {
  return cats.some((c) => c.metal_id === metalId)
}

export function buildChildrenMap(cats: CategoryNode[]): Map<string | null, CategoryNode[]> {
  const map = new Map<string | null, CategoryNode[]>()
  for (const c of cats) {
    const arr = map.get(c.parent_id) ?? []
    arr.push(c)
    map.set(c.parent_id, arr)
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
  }
  return map
}