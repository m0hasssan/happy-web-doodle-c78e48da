import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowRight, Undo2, Send } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"
import { fetchWorkOrders, workOrderStatusBadge, type WorkOrderRow } from "./work-orders"
import { toast } from "sonner"
import { StatGridSkeleton } from "@/components/loading-skeletons"

export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<WorkOrderRow | null>(null)
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = async () => {
    if (!id) return
    setLoading(true)
    const all = await fetchWorkOrders()
    const found = all.find((o) => o.id === id) ?? null
    setOrder(found)
    const allMv = await fetchMovementRows()
    setMovements(allMv.filter((m) => (m as unknown as { work_order_id: string | null }).work_order_id === id))
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const tempReturn = async () => {
    if (!id) return
    setActing(true)
    const { error } = await supabase.rpc("work_order_temp_return", { _id: id })
    setActing(false)
    if (error) return toast.error(error.message)
    toast.success("تم استرداد الأمر مؤقتاً للخزنة")
    load()
  }
  const sendBack = async () => {
    if (!id) return
    setActing(true)
    const { error } = await supabase.rpc("work_order_send_back_to_section", { _id: id })
    setActing(false)
    if (error) return toast.error(error.message)
    toast.success("تمت إعادة الأمر للقسم")
    load()
  }

  if (loading) return <StatGridSkeleton count={4} />
  if (!order) return <Card><CardContent className="py-12 text-center">لم يتم العثور على أمر الشغل</CardContent></Card>

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`أمر شغل ${order.code}`}
        description={`من خزنة «${order.vault_name}» إلى قسم «${order.section_name}»`}
        actions={
          <div className="flex items-center gap-2">
            {workOrderStatusBadge(order)}
            {order.status === "in_progress" && !order.temp_returned_to_vault && (
              <Button onClick={tempReturn} disabled={acting} variant="secondary" className="gap-2">
                <Undo2 className="h-4 w-4" /> استرداد مؤقت للخزنة
              </Button>
            )}
            {order.status === "in_progress" && order.temp_returned_to_vault && (
              <Button onClick={sendBack} disabled={acting} className="gap-2">
                <Send className="h-4 w-4" /> إعادة للقسم
              </Button>
            )}
            <Button asChild variant="outline" className="gap-2">
              <Link to="/work-orders"><ArrowRight className="h-4 w-4" /> رجوع</Link>
            </Button>
          </div>
        }
      />

      {order.notes && (
        <Card>
          <CardContent className="flex flex-col gap-2 py-4">
            <span className="text-xs text-muted-foreground">الملاحظات</span>
            <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">أصناف أمر الشغل</h2>
        <DataTable
          data={movements}
          columns={movementColumns()}
          rowKey={(r) => r.id}
          searchKeys={["code", "metal_name"]}
          emptyMessage="لا توجد أصناف"
        />
      </div>
    </div>
  )
}

export default WorkOrderDetailPage