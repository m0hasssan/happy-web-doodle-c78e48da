import { Link } from "react-router-dom"
import { Undo2, Send, ArrowRight } from "lucide-react"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { workOrderStatusBadge, type WorkOrderRow } from "@/pages/work-orders"
import type { MovementRow } from "@/pages/movements"
import { metalClasses } from "@/lib/metal-colors"
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
import { computeWorkOrderContents } from "@/lib/work-order-contents"

export function WorkOrderCard({
  order,
  movements,
  onChanged,
  showActions = true,
  showDetailsLink = true,
}: {
  order: WorkOrderRow
  movements: MovementRow[]
  onChanged?: () => void
  showActions?: boolean
  showDetailsLink?: boolean
}) {
  const [returnOpen, setReturnOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const { shift: activeShift } = useActiveShift()
  const { displayName } = useAuth()
  const items = computeWorkOrderContents(
    movements,
    order.id,
    order.current_holder_type,
    order.current_holder_id,
  )
  const totalWeight = items.reduce((s, x) => s + x.weight, 0)
  const heldByVault = order.current_holder_type === "vault"
  const heldBySection = order.current_holder_type === "section"

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">{order.code}</span>
            <div className="text-sm">
              من <span className="font-medium">«{order.vault_name}»</span> إلى{" "}
              <span className="font-medium">«{order.section_name}»</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(order.created_at).toLocaleString("ar-EG")}
            </span>
          </div>
          <div className="flex items-center gap-2">{workOrderStatusBadge(order)}</div>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {items.map((m) => {
              const cls = metalClasses(m.metal_color)
              return (
                <Badge
                  key={m.key}
                  variant="outline"
                  className={`${cls.bg} ${cls.text} ${cls.border} gap-1 px-2 py-1`}
                >
                  <span>{m.metal_name}</span>
                  {m.karat && <span className="opacity-80">عيار {m.karat}</span>}
                  {m.category_name && <span className="opacity-80">· {m.category_name}</span>}
                  <span className="font-medium tabular-nums">
                    {Number(m.weight).toLocaleString("ar-EG", { maximumFractionDigits: 3 })} جم
                  </span>
                  {m.count != null && m.count > 0 && (
                    <span className="opacity-80">× {m.count}</span>
                  )}
                </Badge>
              )
            })}
          </div>
        )}

        {order.notes && (
          <div className="rounded-md bg-muted/50 p-2 text-sm whitespace-pre-wrap">
            <span className="text-xs text-muted-foreground">ملاحظات: </span>
            {order.notes}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            إجمالي الوزن:{" "}
            <span className="tabular-nums font-medium text-foreground">
              {totalWeight.toLocaleString("ar-EG", { maximumFractionDigits: 3 })} جم
            </span>
          </span>
          <div className="flex flex-wrap gap-2">
            {showActions && order.status === "in_progress" && heldBySection && (
              <Button onClick={() => setReturnOpen(true)} variant="secondary" size="sm" className="gap-1">
                <Undo2 className="h-3.5 w-3.5" /> استرداد مؤقت لخزنة
              </Button>
            )}
            {showActions && order.status === "in_progress" && heldByVault && (
              <Button onClick={() => setSendOpen(true)} size="sm" className="gap-1">
                <Send className="h-3.5 w-3.5" /> إعادة للقسم
              </Button>
            )}
            {showDetailsLink && (
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link to={`/work-orders/${order.id}`}>
                  التفاصيل <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
      {returnOpen && (
        <WorkOrderTransferDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          order={order}
          direction="return-to-vault"
          onDone={onChanged}
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
                    onChanged?.()
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
    </Card>
  )
}

export default WorkOrderCard