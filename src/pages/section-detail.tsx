import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowRight, Factory as SectionIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { metalClasses } from "@/lib/metal-colors"
import { DataTable } from "@/components/data-table"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"

type Section = { id: string; name: string; status: string }
type Metal = { id: string; code: string; name_ar: string }
type InvRow = { metal_id: string; total_weight: number; karat: string | null }

export function SectionDetailPage() {
  const { sectionId } = useParams<{ sectionId: string }>()
  const [section, setSection] = useState<Section | null>(null)
  const [metals, setMetals] = useState<Metal[]>([])
  const [rows, setRows] = useState<InvRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!sectionId) return
    setLoading(true)
    const [s, m, inv, sm, mv] = await Promise.all([
      supabase.from("manufacturing_sections").select("id,name,status").eq("id", sectionId).single(),
      supabase.from("metals").select("id,code,name_ar").eq("enabled", true),
      supabase.from("section_inventory").select("metal_id,total_weight,karat").eq("section_id", sectionId),
      supabase.from("section_metals").select("metal_id").eq("section_id", sectionId),
      fetchMovementRows({ sectionId }),
    ])
    const allowedIds = new Set((sm.data ?? []).map((x) => x.metal_id))
    setSection((s.data ?? null) as Section | null)
    setMetals(((m.data ?? []) as Metal[]).filter((mm) => allowedIds.has(mm.id)))
    setRows((inv.data ?? []) as InvRow[])
    setMovements(mv)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId])

  const cards = rows
    .filter((r) => Number(r.total_weight) > 0)
    .map((r) => ({ ...r, metal: metals.find((m) => m.id === r.metal_id) }))
    .filter((r) => r.metal)

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
        <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
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
                const cls = metalClasses(c.metal!.code)
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
        </>
      )}
    </div>
  )
}

export default SectionDetailPage
