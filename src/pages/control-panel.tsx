import { Download, Lock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatsCard } from "@/components/stats-card"
import { PriceCard } from "@/components/price-card"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { useGoldPrices, formatTimeAgoAr } from "@/hooks/use-gold-prices"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePermissions } from "@/hooks/use-permissions"
import { toast } from "sonner"

const cards = Array.from({ length: 8 }).map(() => ({
  title: "إجمالي المبيعات ( كاش )",
  unlinked: true as const,
}))

export function ControlPanelPage() {
  const { hasPermission, loading } = usePermissions()
  const { data: goldData, loading: goldLoading, refreshing: goldRefreshing, refresh: refreshGold } = useGoldPrices()

  const canView = hasPermission("view_dashboard")
  const canExport = hasPermission("export_data")

  const getKaratPrice = (k: "24" | "21" | "18") => {
    const v = goldData?.gold?.[k]
    return v && typeof v === "object" ? (v as { sell: number }).sell : undefined
  }
  const goldSubtitle = goldData
    ? `وفقاً لـ eDahab، ${formatTimeAgoAr(goldData.fetched_at)}`
    : "وفقاً لـ eDahab"

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        جارٍ التحقق من الصلاحيات...
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">لا تملك الصلاحية</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              ليس لديك صلاحية «عرض لوحة التحكم». يُرجى التواصل مع مسؤول النظام.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="لوحة التحكم"
        description="مرحباً بك في GemFlow، إليك ملخص العمليات."
        actions={
          <>
            <Select defaultValue="today">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
              </SelectContent>
            </Select>
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
    </div>
  )
}

export default ControlPanelPage
