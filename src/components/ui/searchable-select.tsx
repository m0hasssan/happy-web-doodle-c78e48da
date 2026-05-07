import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type SearchableSelectOption = {
  value: string
  label: React.ReactNode
  /** plain searchable text (defaults to label if it's a string) */
  search?: string
  dir?: "ltr" | "rtl"
}

type Props = {
  value?: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  /** max items visible without scroll (default 6) */
  maxVisible?: number
}

// approximate item height: py-1.5 (12) + text-sm line ~20 = ~32px + 4 spacing
const ITEM_HEIGHT = 32

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "اختر...",
  searchPlaceholder = "بحث...",
  emptyText = "لا توجد نتائج",
  disabled,
  className,
  maxVisible = 6,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-between gap-1.5 px-2.5 font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate" dir={selected?.dir}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-[12rem] p-0"
        align="start"
      >
        <Command
          filter={(val, search) => {
            const opt = options.find((o) => o.value === val)
            const hay = (
              opt?.search ??
              (typeof opt?.label === "string" ? opt.label : "")
            ).toLowerCase()
            return hay.includes(search.toLowerCase()) ? 1 : 0
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList style={{ maxHeight: maxVisible * ITEM_HEIGHT + 8 }}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={(v) => {
                    onValueChange(v)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      value === opt.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span dir={opt.dir} className="truncate">
                    {opt.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}