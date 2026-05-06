import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { toast } from "sonner"

const KARAT_FACTORS: Record<string, number> = {
  "999": 999 / 1000, "995": 995 / 1000, "24": 1,
  "22": 22 / 24, "21": 21 / 24, "18": 18 / 24,
  "14": 14 / 24, "12": 12 / 24, "9": 9 / 24,
  "875": 875 / 1000, "750": 750 / 1000, "748": 748 / 1000,
}
const factor = (k: string | null) => (k ? KARAT_FACTORS[k] ?? Number(k) / 1000 : 1)

export interface SupplierActionsProps {
  supplierId: string
  supplierName: string
  onChanged?: () => void
  onDeleted?: () => void
  size?: "sm" | "default"
}

export function SupplierActions({
  supplierId,
  supplierName,
  onChanged,
  onDeleted,
  size = "sm",
}: SupplierActionsProps) {
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(supplierName)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const openEdit = () => {
    setName(supplierName)
    setEditOpen(true)
  }

  const submitEdit = async () => {
    if (!name.trim()) return toast.error("ادخل اسم المورد")
    setSaving(true)
    const { error } = await supabase.from("suppliers").update({ name: name.trim() }).eq("id", supplierId)
    setSaving(false)
    if (error) return toast.error("فشل تعديل المورد")
    toast.success("تم تعديل المورد")
    setEditOpen(false)
    onChanged?.()
  }

  const checkAndDelete = async () => {
    setDeleting(true)
    try {
      // check movements for any non-zero balance per metal
      const { data: mv, error: mvErr } = await supabase
        .from("movements")
        .select("from_type,from_id,to_type,to_id,karat,weight,metal_id")
        .or(`from_id.eq.${supplierId},to_id.eq.${supplierId}`)
      if (mvErr) throw mvErr
      const balances = new Map<string, number>()
      for (const r of mv ?? []) {
        const sign =
          r.to_type === "supplier" && r.to_id === supplierId
            ? 1
            : r.from_type === "supplier" && r.from_id === supplierId
              ? -1
              : 0
        if (!sign) continue
        const w = Number(r.weight) * factor(r.karat)
        balances.set(r.metal_id, (balances.get(r.metal_id) ?? 0) + sign * w)
      }
      const hasDebt = Array.from(balances.values()).some((v) => Math.abs(v) > 0.0001)
      if (hasDebt) {
        toast.error("لا يمكن حذف المورد: يوجد مديونية له أو عليه")
        setDeleteOpen(false)
        return
      }
      const { error: delErr } = await supabase.from("suppliers").delete().eq("id", supplierId)
      if (delErr) throw delErr
      toast.success("تم حذف المورد")
      setDeleteOpen(false)
      if (onDeleted) onDeleted()
      else navigate("/suppliers")
    } catch (e) {
      toast.error((e as Error).message || "فشل حذف المورد")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size === "sm" ? "icon" : "icon"} className="h-9 w-9">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={openEdit}>
            <Pencil className="h-4 w-4" />
            تعديل
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل المورد</DialogTitle>
            <DialogDescription>عدّل اسم المورد.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-edit-name">الاسم</Label>
            <Input
              id="sup-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المورد"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={submitEdit} disabled={saving}>
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المورد</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المورد "{supplierName}"؟ لا يمكن التراجع عن هذا الإجراء.
              لن يتم الحذف لو كان حساب المورد فيه مديونية له أو عليه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                checkAndDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default SupplierActions
