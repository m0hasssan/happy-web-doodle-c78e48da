import { useState } from "react"
import { Play, Square, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useActiveShift, notifyShiftChange } from "@/hooks/use-active-shift"
import { toast } from "sonner"

export function ShiftControl() {
  const { user, displayName } = useAuth()
  const { shift, loading, refresh } = useActiveShift()
  const [confirmStart, setConfirmStart] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [warnEnd, setWarnEnd] = useState(false)
  const [busy, setBusy] = useState(false)

  const startShift = async () => {
    setBusy(true)
    const { error } = await supabase.from("shifts").insert({
      started_by_user_id: user?.id ?? null,
      started_by_name: displayName,
    })
    setBusy(false)
    setConfirmStart(false)
    if (error) return toast.error("فشل بدء الشيفت")
    toast.success("تم بدء الشيفت")
    notifyShiftChange()
    refresh()
  }

  const proceedEndShift = async () => {
    if (!shift) return
    setBusy(true)
    const { error } = await supabase
      .from("shifts")
      .update({
        ended_at: new Date().toISOString(),
        ended_by_user_id: user?.id ?? null,
        ended_by_name: displayName,
      })
      .eq("id", shift.id)
    setBusy(false)
    setWarnEnd(false)
    if (error) return toast.error("فشل إنهاء الشيفت")
    toast.success("تم إنهاء الشيفت")
    notifyShiftChange()
    refresh()
  }

  const onConfirmEnd = async () => {
    setConfirmEnd(false)
    // check for sections with weight outside vaults
    const { data } = await supabase
      .from("section_inventory")
      .select("total_weight")
      .gt("total_weight", 0)
      .limit(1)
    if (data && data.length > 0) {
      setWarnEnd(true)
    } else {
      proceedEndShift()
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">الشيفت الحالي</span>
              {loading ? (
                <span className="text-xs text-muted-foreground">جارٍ التحميل...</span>
              ) : shift ? (
                <span className="text-xs text-muted-foreground">
                  <span className="font-mono">{shift.code}</span>
                  {" • "}
                  بدأ في {new Date(shift.started_at).toLocaleString("ar-EG")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">لا يوجد شيفت مفتوح</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shift ? (
              <Badge variant="default">مفتوح</Badge>
            ) : (
              <Badge variant="secondary">مغلق</Badge>
            )}
            {shift ? (
              <Button variant="destructive" className="gap-2" onClick={() => setConfirmEnd(true)} disabled={busy}>
                <Square className="h-4 w-4" />
                إنهاء الشيفت
              </Button>
            ) : (
              <Button className="gap-2" onClick={() => setConfirmStart(true)} disabled={busy}>
                <Play className="h-4 w-4" />
                بدء شيفت جديد
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <AlertDialog open={confirmStart} onOpenChange={setConfirmStart}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>بدء شيفت جديد</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من بدء شيفت جديد؟ ستُربط جميع الحركات بهذا الشيفت حتى إنهائه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={startShift} disabled={busy}>تأكيد</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إنهاء الشيفت</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إنهاء الشيفت الحالي؟ لن تتمكن من تسجيل أي حركات بعد الإنهاء حتى تبدأ شيفتاً جديداً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmEnd} disabled={busy}>تأكيد</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={warnEnd} onOpenChange={setWarnEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تحذير: يوجد وزن خارج الخزن</AlertDialogTitle>
            <AlertDialogDescription>
              هناك أوزان لا تزال موجودة داخل أقسام التصنيع خارج الخزن. هل تريد إنهاء الشيفت رغم ذلك؟ ستبقى الأوزان في الأقسام كما هي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={proceedEndShift} disabled={busy}>
              إنهاء الشيفت
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

export default ShiftControl
