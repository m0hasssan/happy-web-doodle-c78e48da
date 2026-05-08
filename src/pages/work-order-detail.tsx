import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowRight, Undo2, Send } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"
import { fetchWorkOrders, workOrderStatusBadge, type WorkOrderRow } from "./work-orders"
import { StatGridSkeleton } from "@/components/loading-skeletons"
import { WorkOrderTransferDialog } from "@/components/work-order-transfer-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { sendWorkOrderBackToSection } from "@/lib/work-order-actions"
import { useActiveShift } from "@/hooks/use-active-shift"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"

export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<WorkOrderRow | null>(null)
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [returnOpen, setReturnOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const { shift: activeShift } = useActiveShift()
  const { displayName } = useAuth()

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

  if (loading) return <StatGridSkeleton count={4} />
  if (!order) return <Card><CardContent className="py-12 text-center">لم يتم العثور على أمر الشغل</CardContent></Card>

  const heldByVault = order.current_holder_type === "vault"
  const heldBySection = order.current_holder_type === "section"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`أمر شغل ${order.code}`}
        description={`من خزنة «${order.vault_name}» إلى قسم «${order.section_name}» — حالياً في «${order.current_holder_name}»`}
        actions={
          <div className="flex items-center gap-2">
            {workOrderStatusBadge(order)}
            {order.status === "in_progress" && heldBySection && (
              <Button onClick={() => setReturnOpen(true)} variant="secondary" className="gap-2">
                <Undo2 className="h-4 w-4" /> استرداد مؤقت لخزنة
              </Button>
            )}
            {order.status === "in_progress" && heldByVault && (
              <Button onClick={() => setSendOpen(true)} className="gap-2">
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
      {returnOpen && (
        <WorkOrderTransferDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          order={order}
          direction="return-to-vault"
          onDone={load}
        />
      )}
      {sendOpen && (
        <AlertDialog open={sendOpen} onOpenChange={setSendOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد إعادة أمر الشغل للقسم</AlertDialogTitle>
              <AlertDialogDescription>
                هل تريد فعلاً إعادة أمر الشغل {order.code} إلى قسم «{order.section_name}» بنفس الأوزان الحالية بدون أي تعديل؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={sending}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                disabled={sending || !activeShift}
                onClick={async (e) => {
                  e.preventDefault()
                  if (!activeShift) return toast.error("ابدأ شيفت أولاً")
                  setSending(true)
                  try {
                    await sendWorkOrderBackToSection(order, {
                      shiftId: activeShift.id,
                      employeeName: displayName,
                    })
                    toast.success("تمت إعادة أمر الشغل للقسم")
                    setSendOpen(false)
                    load()
                  } catch (err) {
                    toast.error((err as Error).message)
                  } finally {
                    setSending(false)
                  }
                }}
              >
                {sending ? "جارٍ الإرسال..." : "تأكيد"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

export default WorkOrderDetailPage