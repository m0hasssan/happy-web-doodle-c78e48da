import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"
import { StatGridSkeleton, TableSkeleton } from "@/components/loading-skeletons"

type Shift = {
  id: string
  code: string
  started_at: string
  ended_at: string | null
  started_by_name: string | null
  ended_by_name: string | null
}

export function ShiftDetailPage() {
  const { shiftId } = useParams<{ shiftId: string }>()
  const [shift, setShift] = useState<Shift | null>(null)
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!shiftId) return
    setLoading(true)
    const [s, mv] = await Promise.all([
      supabase
        .from("shifts")
        .select("id,code,started_at,ended_at,started_by_name,ended_by_name")
        .eq("id", shiftId)
        .single(),
      fetchMovementRows({ shiftId }),
    ])
    setShift((s.data ?? null) as Shift | null)
    setMovements(mv)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={shift ? `الشيفت ${shift.code}` : "الشيفت"}
        description="تفاصيل الشيفت وحركاته"
        backTo="/shifts"
        breadcrumbs={[
          { label: "الشيفتات", to: "/shifts" },
          { label: shift ? shift.code : "الشيفت" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {shift && (
              <Badge variant={shift.ended_at ? "secondary" : "default"}>
                {shift.ended_at ? "منتهي" : "مفتوح"}
              </Badge>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-6">
          <StatGridSkeleton count={4} />
          <TableSkeleton rows={6} columns={6} />
        </div>
      ) : (
        <>
          {shift && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoCard label="وقت البدء" value={new Date(shift.started_at).toLocaleString("ar-EG")} />
              <InfoCard
                label="وقت الإنهاء"
                value={shift.ended_at ? new Date(shift.ended_at).toLocaleString("ar-EG") : "—"}
              />
              <InfoCard label="بدأ بواسطة" value={shift.started_by_name ?? "-"} />
              <InfoCard label="عدد الحركات" value={String(movements.length)} />
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">حركات الشيفت</h2>
            <DataTable
              data={movements}
              columns={movementColumns()}
              rowKey={(r) => r.id}
              searchKeys={["code", "from_name", "to_name", "metal_name", "employee_name"]}
              searchPlaceholder="ابحث في حركات الشيفت..."
              onRefresh={load}
              emptyMessage="لا توجد حركات في هذا الشيفت"
            />
          </div>
        </>
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  )
}

export default ShiftDetailPage
