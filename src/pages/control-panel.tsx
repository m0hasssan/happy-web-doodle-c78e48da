import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatsCard } from "@/components/stats-card"
import { PriceCard } from "@/components/price-card"
import { PageHeader } from "@/components/page-header"
import { useGoldPrices, formatTimeAgoAr } from "@/hooks/use-gold-prices"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useState } from "react"
import { usePermissions } from "@/hooks/use-permissions"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import { ShiftControl } from "@/components/shift-control"
import { StatGridSkeleton } from "@/components/loading-skeletons"

const cards = Array.from({ length: 8 }).map(() => ({
  title: "إجمالي المبيعات ( كاش )",
  unlinked: true as const,
}))

export function ControlPanelPage() {
  const { hasPermission, loading } = usePermissions()
  const { displayName } = useAuth()
  const [dateRange, setDateRange] = useState("today")
  const { data: goldData, loading: goldLoading, refreshing: goldRefreshing, refresh: refreshGold } = useGoldPrices()

  const canExport = hasPermission("export_stats")
  const canViewStats = hasPermission("view_stats")
  const canViewShift = hasPermission("view_current_shift")

  const getKaratPrice = (k: "24" | "21" | "18") => {
    const v = goldData?.gold?.[k]
    return v && typeof v === "object" ? (v as { sell: number }).sell : undefined
  }
  const goldSubtitle = goldData
    ? `وفقاً لـ eDahab، ${formatTimeAgoAr(goldData.fetched_at)}`
    : "وفقاً لـ eDahab"

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <StatGridSkeleton count={3} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
        <StatGridSkeleton count={8} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          مرحباً، <span className="font-semibold text-foreground">{displayName}</span>
        </p>
      </div>
      <PageHeader
        title="لوحة التحكم"
        description="مرحباً بك في GemFlow، إليك ملخص العمليات."
        actions={
          <>
            <div className="w-32">
              <SearchableSelect
                value={dateRange}
                onValueChange={setDateRange}
                options={[
                  { value: "today", label: "اليوم", search: "اليوم" },
                  { value: "week", label: "هذا الأسبوع", search: "هذا الأسبوع" },
                  { value: "month", label: "هذا الشهر", search: "هذا الشهر" },
                ]}
              />
            </div>
            <Button
              className="gap-2"
              disabled={!canExport}
              onClick={() => {
                if (!canExport) return
                toast.success("جارٍ استخراج البيانات...")
              }}
              title={!canExport ? "لا تملك صلاحية استخراج البيانات" : undefined}
            >
              <Download className="h-4 w-4" />
              استخراج البيانات
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                await refreshGold()
                toast.success("تم تحديث أسعار الذهب")
              }}
              disabled={goldRefreshing}
              title="تحديث أسعار الذهب"
            >
              <RefreshCw className={`h-4 w-4 ${goldRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </>
        }
      />

      {canViewShift && <ShiftControl />}

      {canViewStats && (
      <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PriceCard
          title="ذهب عيار 24"
          value={getKaratPrice("24")}
          loading={goldLoading}
          subtitle={goldSubtitle}
        />
        <PriceCard
          title="ذهب عيار 21"
          value={getKaratPrice("21")}
          loading={goldLoading}
          subtitle={goldSubtitle}
        />
        <PriceCard
          title="ذهب عيار 18"
          value={getKaratPrice("18")}
          loading={goldLoading}
          subtitle={goldSubtitle}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c, i) => (
          <StatsCard key={i} {...c} />
        ))}
      </div>
      </>
      )}
    </div>
  )
}

export default ControlPanelPage
