import * as React from "react"
import { ChevronDown, ChevronLeft } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  buildPermissionTree,
  togglePermInTree,
  getAllEntries,
  countTree,
  entryKey,
  type PermNode,
  type PermissionEntry,
} from "@/lib/permissions-tree"

interface Props {
  value: PermissionEntry[]
  onChange: (next: PermissionEntry[]) => void
  vaults: { id: string; name: string }[]
  sections: { id: string; name: string }[]
  disabled?: boolean
}

function NodeRow({
  node,
  depth,
  selected,
  parentEnabled,
  onToggle,
  disabled,
}: {
  node: PermNode
  depth: number
  selected: Set<string>
  parentEnabled: boolean
  onToggle: (n: PermNode) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(true)
  const checked = selected.has(node.key)
  const hasChildren = !!node.children?.length
  const rowDisabled = disabled || !parentEnabled || !!node.locked
  const effectiveChecked = node.locked ? true : checked

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 rounded-md py-1.5 pe-2 ps-1 text-sm hover:bg-muted/50",
          rowDisabled && "opacity-50",
        )}
        style={{ paddingInlineStart: `${depth * 18 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            aria-label={open ? "طي" : "فتح"}
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="inline-block h-5 w-5 shrink-0" />
        )}
        <Checkbox
          id={`perm-${node.key}`}
          checked={effectiveChecked}
          disabled={rowDisabled}
          onCheckedChange={() => {
            if (node.locked) return
            onToggle(node)
          }}
        />
        <label
          htmlFor={`perm-${node.key}`}
          className={cn(
            "flex-1 cursor-pointer select-none",
            rowDisabled && "cursor-not-allowed",
          )}
        >
          {node.label}
        </label>
      </div>
      {hasChildren && open && (
        <div className="border-s border-dashed border-border/60 ms-[14px]">
          {node.children!.map((c) => (
            <NodeRow
              key={c.key}
              node={c}
              depth={depth + 1}
              selected={selected}
              parentEnabled={effectiveChecked}
              onToggle={onToggle}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function PermissionTree({
  value,
  onChange,
  vaults,
  sections,
  disabled,
}: Props) {
  const tree = React.useMemo(
    () => buildPermissionTree(vaults, sections),
    [vaults, sections],
  )
  const selectedKeys = React.useMemo(
    () => new Set(value.map(entryKey)),
    [value],
  )
  const total = countTree(tree)

  const handleToggle = (node: PermNode) => {
    onChange(togglePermInTree(tree, value, node))
  }

  const selectAll = () => onChange(getAllEntries(tree))
  const clearAll = () => onChange([])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          المحدد: {value.length} / {total}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            تحديد الكل
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            إلغاء الكل
          </Button>
        </div>
      </div>
      <div className="rounded-md border p-2">
        {tree.map((n) => (
          <NodeRow
            key={n.key}
            node={n}
            depth={0}
            selected={selectedKeys}
            parentEnabled={true}
            onToggle={handleToggle}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}

export default PermissionTree
