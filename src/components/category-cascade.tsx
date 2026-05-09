import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { type CategoryNode, getCategoryPath } from "@/lib/category-tree"

type Props = {
  metalId: string
  categories: CategoryNode[]
  value: string
  onChange: (id: string) => void
  /** Per-leaf eligibility predicate. A node is shown if it (or any descendant) is a leaf passing this filter. */
  leafFilter?: (c: CategoryNode) => boolean
  disabled?: boolean
  levelWidthClass?: string
}

/**
 * Renders cascading category selects.
 * - First select shows root categories for the metal.
 * - When the user picks a category that has (eligible) children, an additional select appears
 *   for the next level, and so on until a leaf is reached.
 * - The exposed value is always the deepest selected category id.
 * - If no categories exist for the metal, renders nothing.
 */
export function CategoryCascade({
  metalId,
  categories,
  value,
  onChange,
  leafFilter,
  disabled,
  levelWidthClass = "w-40",
}: Props) {
  const childrenMap = useMemo(() => {
    const m = new Map<string | null, CategoryNode[]>()
    for (const c of categories) {
      if (c.metal_id !== metalId) continue
      const arr = m.get(c.parent_id) ?? []
      arr.push(c)
      m.set(c.parent_id, arr)
    }
    for (const arr of m.values()) {
      arr.sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
      )
    }
    return m
  }, [categories, metalId])

  const eligible = useMemo(() => {
    const set = new Set<string>()
    const visit = (parentId: string | null): boolean => {
      const ch = childrenMap.get(parentId) ?? []
      let any = false
      for (const c of ch) {
        const grand = childrenMap.get(c.id) ?? []
        const ok =
          grand.length === 0 ? (leafFilter ? leafFilter(c) : true) : visit(c.id)
        if (ok) {
          set.add(c.id)
          any = true
        }
      }
      return any
    }
    visit(null)
    return set
  }, [childrenMap, leafFilter])

  const path = useMemo(
    () => (value ? getCategoryPath(value, categories) : []),
    [value, categories],
  )

  // Build the visible levels.
  type Level = { parentId: string | null; selected: string; options: CategoryNode[] }
  const levels: Level[] = []
  let parentId: string | null = null
  for (let i = 0; ; i++) {
    const opts = (childrenMap.get(parentId) ?? []).filter((c) => eligible.has(c.id))
    if (opts.length === 0) break
    const selected = path[i] ?? ""
    levels.push({ parentId, selected, options: opts })
    if (!selected) break
    const selChildren = (childrenMap.get(selected) ?? []).filter((c) => eligible.has(c.id))
    if (selChildren.length === 0) break
    parentId = selected
  }

  if (levels.length === 0) return null

  const handleChange = (level: number, newId: string) => {
    const newPath = path.slice(0, level)
    if (newId) newPath.push(newId)
    onChange(newPath.length > 0 ? newPath[newPath.length - 1] : "")
  }

  return (
    <>
      {levels.map((lv, i) => (
        <div key={i} className={`flex ${levelWidthClass} flex-col gap-1.5`}>
          <Label className="text-xs">
            {i === 0 ? "التصنيف" : `تصنيف فرعي ${i}`}
          </Label>
          <SearchableSelect
            value={lv.selected}
            onValueChange={(v) => handleChange(i, v)}
            disabled={disabled}
            placeholder={i === 0 ? "التصنيف" : "اختر..."}
            options={lv.options.map((c) => ({
              value: c.id,
              label: c.name,
              search: c.name,
            }))}
          />
        </div>
      ))}
    </>
  )
}