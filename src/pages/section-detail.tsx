import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Factory as SectionIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { metalClasses } from "@/lib/metal-colors"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"
import { fetchWorkOrders, workOrderColumns, type WorkOrderRow } from "./work-orders"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WorkOrderCard } from "@/components/work-order-card"
import { DataTable } from "@/components/data-table"
import { usePermissions } from "@/hooks/use-permissions"
import { Lock } from "lucide-react"
import { StatGridSkeleton } from "@/components/loading-skeletons"
import { formatWeight } from "@/lib/number-format"
import { buildCategoryPathMap, type CategoryNode } from "@/lib/category-tree"

type Section = { id: string; name: string; status: string }
type Metal = { id: string; code: string; name_ar: string; color: string }
type InvRow = {
  metal_id: string
  total_weight: number
  karat: string | null
  category_id: string | null
  total_count: number | null
}
type Category = CategoryNode
type ShrinkRow = { metal_id: string; pure_999_weight: number }

export function SectionDetailPage() {
  const { sectionId } = useParams<{ sectionId: string }>()
  const { hasPermission, loading: permLoading } = usePermissions()
  const [section, setSection] = useState<Section | null>(null)
  const [metals, setMetals] = useState<Metal[]>([])
  const [rows, setRows] = useState<InvRow[]>([])
  const [categoriesById, setCategoriesById] = useState<Map<string, string>>(new Map())
  const [shrinkage, setShrinkage] = useState<ShrinkRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!sectionId) return
    setLoading(true)
    const [s, m, inv, sm, mv, wo, sh, cats] = await Promise.all([
      supabase.from("manufacturing_sections").select("id,name,status").eq("id", sectionId).single(),
      supabase.from("metals").select("id,code,name_ar,color").eq("enabled", true),
      supabase
        .from("section_inventory")
        .select("metal_id,total_weight,karat,category_id,total_count")
        .eq("section_id", sectionId),
      supabase.from("section_metals").select("metal_id").eq("section_id", sectionId),
      fetchMovementRows({ sectionId }),
      fetchWorkOrders({ sectionId }),
      supabase.from("work_order_shrinkage").select("metal_id,pure_999_weight").eq("section_id", sectionId),
      supabase.from("metal_categories").select("id,metal_id,name,requires_count,parent_id"),
    ])
    const allowedIds = new Set((sm.data ?? []).map((x) => x.metal_id))
    setSection((s.data ?? null) as Section | null)
    setMetals(((m.data ?? []) as Metal[]).filter((mm) => allowedIds.has(mm.id)))
    setRows((inv.data ?? []) as InvRow[])
    setShrinkage((sh.data ?? []) as ShrinkRow[])
    setCategoriesById(buildCategoryPathMap((cats.data ?? []) as Category[]))
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

  // Aggregate inventory rows by metal+karat (sum across categories) for the
  // top-level cards, while keeping a per-category breakdown to display under
  // each card. 999 rows split into work portion vs shrinkage loss.
  type CardEntry = {
    metal: Metal
    karat: string | null
    weight: number
    breakdown: Array<{ name: string; weight: number; count: number | null }>
  }
  const aggMap = new Map<string, CardEntry>()
  for (const r of rows) {
    const metal = metals.find((m) => m.id === r.metal_id)
    if (!metal) continue
    const total = Number(r.total_weight)
    if (total <= 0.0001) continue
    const key = `${r.metal_id}__${r.karat ?? ""}`
    let entry = aggMap.get(key)
    if (!entry) {
      entry = { metal, karat: r.karat, weight: 0, breakdown: [] }
      aggMap.set(key, entry)
    }
    entry.weight += total
    if (r.category_id) {
      const name = categoriesById.get(r.category_id) ?? "—"
      entry.breakdown.push({ name, weight: total, count: r.total_count })
    }
  }
  const workCards: CardEntry[] = []
  const lossCards: CardEntry[] = []
  for (const c of aggMap.values()) {
    if (c.karat === "999") {
      const loss = Math.min(shrinkByMetal.get(c.metal.id) ?? 0, c.weight)
      const work = c.weight - loss
      if (work > 0.0001) workCards.push({ ...c, weight: work })
      if (loss > 0.0001) lossCards.push({ ...c, weight: loss, breakdown: [] })
    } else {
      workCards.push(c)
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
        backTo="/sections"
        breadcrumbs={[
          { label: "أقسام التصنيع", to: "/sections" },
          { label: section?.name ?? "القسم" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {section && (
              <Badge variant={section.status === "active" ? "default" : "secondary"}>
                {section.status === "active" ? "نشط" : "معطل"}
              </Badge>
            )}
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
                const cls = metalClasses(c.metal.color)
                return (
                  <Card key={i} size="sm" className={`${cls.bg} ${cls.border} border`}>
                    <CardContent className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${cls.text}`}>{c.metal.name_ar}</span>
                        {c.karat && (
                          <Badge variant="outline" className={`${cls.text} ${cls.border}`}>
                            عيار {c.karat}
                          </Badge>
                        )}
                      </div>
                      <div className={`text-xl font-bold tabular-nums ${cls.text}`}>
                        {formatWeight(Number(c.weight))}
                        <span className="ms-1 text-xs font-normal opacity-70">جم</span>
                      </div>
                      {c.breakdown.length > 0 && (
                        <div className={`mt-1 flex flex-col gap-0.5 text-[11px] ${cls.text} opacity-90`}>
                          {c.breakdown.map((b, j) => (
                            <div key={j} className="flex items-center justify-between gap-2">
                              <span className="truncate">
                                {b.count != null ? `${b.count}× ` : ""}
                                {b.name}
                              </span>
                              <span className="tabular-nums">
                                {formatWeight(b.weight)} جم
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
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
                  const cls = metalClasses(c.metal.color)
                  return (
                    <Card key={`loss-${i}`} size="sm" className={`${cls.bg} ${cls.border} border border-dashed`}>
                      <CardContent className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${cls.text}`}>{c.metal.name_ar}</span>
                          <Badge variant="outline" className={`${cls.text} ${cls.border}`}>
                            عيار 999
                          </Badge>
                        </div>
                        <div className={`text-xl font-bold tabular-nums ${cls.text}`}>
                          {formatWeight(Number(c.weight))}
                          <span className="ms-1 text-xs font-normal opacity-70">جم</span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}

          {workOrders.filter((w) => w.current_holder_type === "section" && w.current_holder_id === sectionId && w.status === "in_progress").length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">أوامر شغل في حوزة هذا القسم</h2>
              <div className="flex flex-col gap-3">
                {workOrders
                  .filter((w) => w.current_holder_type === "section" && w.current_holder_id === sectionId && w.status === "in_progress")
                  .map((wo) => (
                    <WorkOrderCard key={wo.id} order={wo} movements={movements} onChanged={load} />
                  ))}
              </div>
            </div>
          )}

          {canMovements && (
            <Tabs defaultValue="movements" className="flex flex-col gap-3">
              <TabsList>
                <TabsTrigger value="movements">حركات القسم</TabsTrigger>
                <TabsTrigger value="work-orders">أوامر الشغل</TabsTrigger>
              </TabsList>
              <TabsContent value="movements">
                <DataTable
                  data={movements}
                  columns={movementColumns()}
                  rowKey={(r) => r.id}
                  searchKeys={["code", "from_name", "to_name", "metal_name", "employee_name"]}
                  searchPlaceholder="ابحث في حركات القسم..."
                  onRefresh={load}
                  emptyMessage="لا توجد حركات لهذا القسم بعد"
                />
              </TabsContent>
              <TabsContent value="work-orders">
                <DataTable
                  data={workOrders}
                  columns={workOrderColumns()}
                  rowKey={(r) => r.id}
                  searchKeys={["code", "vault_name", "section_name"]}
                  searchPlaceholder="ابحث في أوامر الشغل..."
                  onRefresh={load}
                  emptyMessage="لا توجد أوامر شغل لهذا القسم بعد"
                />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  )
}

export default SectionDetailPage
