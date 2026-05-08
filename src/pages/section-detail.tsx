import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowRight, Factory as SectionIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { metalClasses } from "@/lib/metal-colors"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"
import { fetchWorkOrders, type WorkOrderRow } from "./work-orders"
import { WorkOrderCard } from "@/components/work-order-card"
import { DataTable } from "@/components/data-table"
import { usePermissions } from "@/hooks/use-permissions"
import { Lock } from "lucide-react"
import { StatGridSkeleton } from "@/components/loading-skeletons"

type Section = { id: string; name: string; status: string }
type Metal = { id: string; code: string; name_ar: string; color: string }
type InvRow = { metal_id: string; total_weight: number; karat: string | null }
type ShrinkRow = { metal_id: string; pure_999_weight: number }

export function SectionDetailPage() {
  const { sectionId } = useParams<{ sectionId: string }>()
  const { hasPermission, loading: permLoading } = usePermissions()
  const [section, setSection] = useState<Section | null>(null)
  const [metals, setMetals] = useState<Metal[]>([])
  const [rows, setRows] = useState<InvRow[]>([])
  const [shrinkage, setShrinkage] = useState<ShrinkRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!sectionId) return
    setLoading(true)
    const [s, m, inv, sm, mv, wo, sh] = await Promise.all([
      supabase.from("manufacturing_sections").select("id,name,status").eq("id", sectionId).single(),
      supabase.from("metals").select("id,code,name_ar,color").eq("enabled", true),
      supabase.from("section_inventory").select("metal_id,total_weight,karat").eq("section_id", sectionId),
      supabase.from("section_metals").select("metal_id").eq("section_id", sectionId),
      fetchMovementRows({ sectionId }),
      fetchWorkOrders({ sectionId }),
      supabase.from("work_order_shrinkage").select("metal_id,pure_999_weight").eq("section_id", sectionId),
    ])
    const allowedIds = new Set((sm.data ?? []).map((x) => x.metal_id))
    setSection((s.data ?? null) as Section | null)
    setMetals(((m.data ?? []) as Metal[]).filter((mm) => allowedIds.has(mm.id)))
    setRows((inv.data ?? []) as InvRow[])
    setShrinkage((sh.data ?? []) as ShrinkRow[])
    setMovements(mv)
    setWorkOrders(wo)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId])

  // Aggregate shrinkage per metal (always karat 999)
  const shrinkByMetal = new Map<string, number>()
  for (const s of shrinkage) {
    shrinkByMetal.set(s.metal_id, (shrinkByMetal.get(s.metal_id) ?? 0) + Number(s.pure_999_weight))
  }

  // Split each inventory row: شرنخ portion vs work-order portion
  const workCards: Array<InvRow & { metal?: Metal }> = []
  const lossCards: Array<InvRow & { metal?: Metal }> = []
  for (const r of rows) {
    const metal = metals.find((m) => m.id === r.metal_id)
    if (!metal) continue
    const total = Number(r.total_weight)
    if (total <= 0) continue
    if (r.karat === "999") {
      const loss = Math.min(shrinkByMetal.get(r.metal_id) ?? 0, total)
      const work = total - loss
      if (work > 0.0001) workCards.push({ ...r, total_weight: work, metal })
      if (loss > 0.0001) lossCards.push({ ...r, total_weight: loss, metal })
    } else {
      workCards.push({ ...r, metal })
    }
  }
  const cards = workCards

  const canAccess = sectionId ? hasPermission("access_section", sectionId) : false
  const canMovements = sectionId ? hasPermission("view_section_movements", sectionId) : false

  if (!permLoading && sectionId && !canAccess) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">لا تملك الصلاحية</h2>
            <p className="text-sm text-muted-foreground">ليس لديك صلاحية الدخول لهذا القسم.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={section?.name ?? "القسم"}
        description="تفاصيل الأوزان الموجودة في القسم"
        actions={
          <div className="flex items-center gap-2">
            {section && (
              <Badge variant={section.status === "active" ? "default" : "secondary"}>
                {section.status === "active" ? "نشط" : "معطل"}
              </Badge>
            )}
            <Button asChild variant="outline" className="gap-2">
              <Link to="/sections">
                <ArrowRight className="h-4 w-4" />
                رجوع
              </Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <StatGridSkeleton count={8} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
      ) : (
        <>
          {cards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <SectionIcon className="h-10 w-10" />
                <p>القسم فارغ</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {cards.map((c, i) => {
                const cls = metalClasses(c.metal!.color)
                return (
                  <Card key={i} size="sm" className={`${cls.bg} ${cls.border} border`}>
                    <CardContent className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${cls.text}`}>{c.metal!.name_ar}</span>
                        {c.karat && (
                          <Badge variant="outline" className={`${cls.text} ${cls.border}`}>
                            عيار {c.karat}
                          </Badge>
                        )}
                      </div>
                      <div className={`text-xl font-bold tabular-nums ${cls.text}`}>
                        {Number(c.total_weight).toLocaleString("ar-EG", { maximumFractionDigits: 3 })}
                        <span className="ms-1 text-xs font-normal opacity-70">جم</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {lossCards.length > 0 && (
            <>
              <div className="relative my-2">
                <Separator />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-background px-3 text-xs font-medium text-muted-foreground">
                    خسسيات القسم
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {lossCards.map((c, i) => {
                  const cls = metalClasses(c.metal!.color)
                  return (
                    <Card key={`loss-${i}`} size="sm" className={`${cls.bg} ${cls.border} border border-dashed`}>
                      <CardContent className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${cls.text}`}>{c.metal!.name_ar}</span>
                          <Badge variant="outline" className={`${cls.text} ${cls.border}`}>
                            عيار 999
                          </Badge>
                        </div>
                        <div className={`text-xl font-bold tabular-nums ${cls.text}`}>
                          {Number(c.total_weight).toLocaleString("ar-EG", { maximumFractionDigits: 3 })}
                          <span className="ms-1 text-xs font-normal opacity-70">جم</span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">أوامر الشغل الواردة</h2>
            {workOrders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  لا توجد أوامر شغل لهذا القسم بعد
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {workOrders.map((wo) => (
                  <WorkOrderCard
                    key={wo.id}
                    order={wo}
                    movements={movements}
                    onChanged={load}
                  />
                ))}
              </div>
            )}
          </div>

          {canMovements && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">حركات القسم</h2>
            <DataTable
              data={movements}
              columns={movementColumns()}
              rowKey={(r) => r.id}
              searchKeys={["code", "from_name", "to_name", "metal_name", "employee_name"]}
              searchPlaceholder="ابحث في حركات القسم..."
              onRefresh={load}
              emptyMessage="لا توجد حركات لهذا القسم بعد"
            />
          </div>
          )}
        </>
      )}
    </div>
  )
}

export default SectionDetailPage
