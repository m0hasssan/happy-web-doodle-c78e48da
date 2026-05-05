import { Check } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export interface StatsCardProps {
  title: string
  value?: string | number
  unit?: string
  subtitle?: string
  data?: number[]
  className?: string
  /** عند true يعرض الكارت في حالة "غير مربوط ببيانات" مع خط مستقيم */
  unlinked?: boolean
}

const chartConfig = {
  value: {
    label: "Value",
    color: "var(--primary)",
  },
} satisfies ChartConfig

const defaultData = [12, 28, 18, 42, 30, 22, 36, 24, 32]
const flatData = [0, 0, 0, 0, 0, 0, 0, 0, 0]

export function StatsCard({
  title,
  value,
  unit = "ج.م.",
  subtitle = "إجمالي المحصل النقدي",
  data,
  className,
  unlinked = false,
}: StatsCardProps) {
  const effectiveData = unlinked ? flatData : (data ?? defaultData)
  const chartData = effectiveData.map((v, i) => ({ index: i, value: v }))

  const strokeColor = unlinked ? "var(--muted-foreground)" : "var(--primary)"
  const fillId = unlinked ? "stats-card-fill-muted" : "stats-card-fill"

  return (
    <Card className={cn("overflow-hidden p-0 gap-0", className)}>
      <CardContent className="flex flex-col gap-4 p-5 pb-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              unlinked
                ? "bg-muted text-muted-foreground"
                : "bg-primary/15 text-primary",
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {unlinked ? (
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
          <p className="text-xs text-muted-foreground">
            {unlinked ? "قم بربط الرسم ببيانات" : subtitle}
          </p>
        </div>
      </CardContent>

      <div className="h-24 w-full">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="linear"
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={1.5}
                fill={`url(#${fillId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </Card>
  )
}

export default StatsCard
