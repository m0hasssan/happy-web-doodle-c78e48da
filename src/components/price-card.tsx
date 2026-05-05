import { Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface PriceCardProps {
  title: string
  value?: string | number
  unit?: string
  subtitle?: string
  loading?: boolean
  className?: string
}

export function PriceCard({
  title,
  value,
  unit = "ج.م.",
  subtitle,
  loading = false,
  className,
}: PriceCardProps) {
  const isUnlinked = !loading && (value === undefined || value === null)

  return (
    <Card className={cn("overflow-hidden p-0 gap-0", className)}>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              isUnlinked
                ? "bg-muted text-muted-foreground"
                : "bg-primary/15 text-primary",
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {loading ? (
            <span className="text-lg font-semibold tracking-tight text-muted-foreground">
              جارٍ التحميل...
            </span>
          ) : isUnlinked ? (
            <span className="text-lg font-semibold tracking-tight text-muted-foreground">
              لم يتم الربط
            </span>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {typeof value === "number"
                  ? value.toLocaleString("en-US")
                  : value}
              </span>
              <span className="text-base font-medium text-foreground">
                {unit}
              </span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default PriceCard
