import { Link } from "react-router-dom"
import { Undo2, Send, ArrowLeft, CheckCircle2, XCircle } from "lucide-react"
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
import { sendWorkOrderBackToSection, cancelWorkOrder, returnWorkOrderToVault } from "@/lib/work-order-actions"
import { supabase } from "@/integrations/supabase/client"
import { useActiveShift } from "@/hooks/use-active-shift"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import { computeWorkOrderContents } from "@/lib/work-order-contents"
import { formatWeight } from "@/lib/number-format"
import { usePermissions } from "@/hooks/use-permissions"

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
  const [returning, setReturning] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [settleSectionOpen, setSettleSectionOpen] = useState(false)
  const [settleVaultOpen, setSettleVaultOpen] = useState(false)
  const [settling, setSettling] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const { shift: activeShift } = useActiveShift()
  const { displayName } = useAuth()
  const { hasPermission } = usePermissions()
  const canTransfer = hasPermission("transfer_work_order")
  const canSettle = hasPermission("settle_work_order")
  const items = computeWorkOrderContents(
    movements,
    order.id,
    order.current_holder_type,
    order.current_holder_id,
  )
  const totalWeight = items.reduce((s, x) => s + x.weight, 0)
  const heldByVault = order.current_holder_type === "vault"
  const heldBySection = order.current_holder_type === "section"
  // أمر الشغل مؤهَّل للإلغاء فقط إذا كانت كل الحركات هي الإصدار الأولي
  // من نفس الخزنة إلى نفس القسم (لم يحدث استرداد ولا تحويل ولا خسية).
  const woMovements = movements.filter((m) => m.work_order_id === order.id)
  const eligibleToCancel =
    woMovements.length > 0 &&
    woMovements.every(
      (m) =>
        m.from_type === "vault" &&
        m.from_id === order.from_vault_id &&
        m.to_type === "section" &&
        m.to_id === order.to_section_id,
    )

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
          <div className="flex flex-wrap items-center gap-2">
            {workOrderStatusBadge(order)}
            {showDetailsLink && (
              <Link
                to={`/work-orders/${order.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                التفاصيل <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
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
                    {formatWeight(Number(m.weight))} جم
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
              {formatWeight(totalWeight)} جم
            </span>
          </span>
          <div className="flex flex-wrap gap-2">
            {showActions && canTransfer && order.status === "in_progress" && heldBySection && (
              <Button onClick={() => setReturnOpen(true)} variant="secondary" size="sm" className="gap-1">
                <Undo2 className="h-3.5 w-3.5" /> استرداد مؤقت لخزنة
              </Button>
            )}
            {showActions && canTransfer && order.status === "in_progress" && heldByVault && (
              <Button onClick={() => setSendOpen(true)} size="sm" className="gap-1">
                <Send className="h-3.5 w-3.5" /> إعادة للقسم
              </Button>
            )}
            {showActions && canSettle && order.status === "in_progress" && (
              <Button
                onClick={() => (heldBySection ? setSettleSectionOpen(true) : setSettleVaultOpen(true))}
                size="sm"
                variant="default"
                className="gap-1"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> تسوية
              </Button>
            )}
            {showActions &&
              canTransfer &&
              order.status === "in_progress" &&
              heldBySection &&
              eligibleToCancel && (
                <Button
                  onClick={() => setCancelOpen(true)}
                  size="sm"
                  variant="destructive"
                  className="gap-1"
                >
                  <XCircle className="h-3.5 w-3.5" /> إلغاء الأمر
                </Button>
              )}
          </div>
        </div>
      </CardContent>
      {returnOpen && (
        <AlertDialog open={returnOpen} onOpenChange={setReturnOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد استرداد مؤقت لخزنة</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم نقل كامل الأوزان الحالية لأمر الشغل {order.code} من قسم «{order.section_name}» إلى خزنة «{order.vault_name}» بنفس العيارات والتصنيفات والأعداد، وتظل محجوزة لأمر الشغل. هل تريد المتابعة؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={returning}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                disabled={returning || !activeShift}
                onClick={async (e) => {
                  e.preventDefault()
                  if (!activeShift) return toast.error("ابدأ شيفت أولاً")
                  setReturning(true)
                  try {
                    await returnWorkOrderToVault(order, {
                      shiftId: activeShift.id,
                      employeeName: displayName,
                    })
                    toast.success("تم استرداد أمر الشغل للخزنة")
                    setReturnOpen(false)
                    onChanged?.()
                  } catch (err) {
                    toast.error((err as Error).message)
                  } finally {
                    setReturning(false)
                  }
                }}
              >
                {returning ? "جارٍ الاسترداد..." : "تأكيد"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {settleSectionOpen && (
        <WorkOrderTransferDialog
          open={settleSectionOpen}
          onOpenChange={setSettleSectionOpen}
          order={order}
          direction="return-to-vault"
          settle
          onDone={onChanged}
        />
      )}
      {settleVaultOpen && (
        <AlertDialog open={settleVaultOpen} onOpenChange={setSettleVaultOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد تسوية أمر الشغل</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم قفل أمر الشغل {order.code} وتحويل الأوزان الموجودة حالياً في خزنة «{order.current_holder_name}» من رصيد محجوز إلى رصيد متاح. هل أنت متأكد؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={settling}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                disabled={settling}
                onClick={async (e) => {
                  e.preventDefault()
                  setSettling(true)
                  try {
                    const { error } = await supabase
                      .from("work_orders")
                      .update({ status: "delivered" })
                      .eq("id", order.id)
                    if (error) throw error
                    toast.success("تمت تسوية أمر الشغل")
                    setSettleVaultOpen(false)
                    onChanged?.()
                  } catch (err) {
                    toast.error((err as Error).message)
                  } finally {
                    setSettling(false)
                  }
                }}
              >
                {settling ? "جارٍ التنفيذ..." : "تأكيد التسوية"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
      {cancelOpen && (
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد إلغاء أمر الشغل</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم إلغاء أمر الشغل {order.code} وإرجاع كامل الأوزان إلى خزنة «{order.vault_name}» بنفس العيارات والتصنيفات. لن يتم حذف الأمر أو حركاته، فقط تتغير الحالة إلى «ملغي» وتُسجَّل حركات مضادة. هل أنت متأكد؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>تراجع</AlertDialogCancel>
              <AlertDialogAction
                disabled={cancelling || !activeShift}
                onClick={async (e) => {
                  e.preventDefault()
                  if (!activeShift) return toast.error("ابدأ شيفت أولاً")
                  setCancelling(true)
                  try {
                    await cancelWorkOrder(order, {
                      shiftId: activeShift.id,
                      employeeName: displayName,
                    })
                    toast.success("تم إلغاء أمر الشغل")
                    setCancelOpen(false)
                    onChanged?.()
                  } catch (err) {
                    toast.error((err as Error).message)
                  } finally {
                    setCancelling(false)
                  }
                }}
              >
                {cancelling ? "جارٍ الإلغاء..." : "تأكيد الإلغاء"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  )
}

export default WorkOrderCard