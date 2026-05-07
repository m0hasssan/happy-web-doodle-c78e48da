import * as React from "react"
import { ChevronDown, ChevronLeft } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AppPermission } from "@/contexts/permissions-context"
import {
  PERMISSION_TREE,
  type PermissionNode,
  togglePermInTree,
  getAllPermissionValues,
} from "@/lib/permissions-tree"

interface Props {
  value: AppPermission[]
  onChange: (next: AppPermission[]) => void
  disabled?: boolean
}

function NodeRow({
  node,
  depth,
  value,
  parentEnabled,
  onToggle,
  disabled,
}: {
  node: PermissionNode
  depth: number
  value: AppPermission[]
  parentEnabled: boolean
  onToggle: (p: AppPermission) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(true)
  const checked = value.includes(node.value)
  const hasChildren = !!node.children?.length
  const rowDisabled = disabled || !parentEnabled

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
          id={`perm-${node.value}`}
          checked={checked}
          disabled={rowDisabled}
          onCheckedChange={() => onToggle(node.value)}
        />
        <label
          htmlFor={`perm-${node.value}`}
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
              key={c.value}
              node={c}
              depth={depth + 1}
              value={value}
              parentEnabled={checked}
              onToggle={onToggle}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function PermissionTree({ value, onChange, disabled }: Props) {
  const handleToggle = (p: AppPermission) => {
    onChange(togglePermInTree(value, p))
  }

  const selectAll = () => onChange(getAllPermissionValues())
  const clearAll = () => onChange([])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          المحدد: {value.length} / {getAllPermissionValues().length}
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
        {PERMISSION_TREE.map((n) => (
          <NodeRow
            key={n.value}
            node={n}
            depth={0}
            value={value}
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