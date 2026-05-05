import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, FileText, Phone, User } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

type Supplier = { id: string; name: string; phone: string | null }

type SupplierRow = Supplier & {
  diff_875: number
}

// Karat conversion factors to pure gold (24)
const KARAT_FACTORS: Record<string, number> = {
  "999": 999 / 1000,
  "995": 995 / 1000,
  "24": 1,
  "22": 22 / 24,
  "21": 21 / 24,
  "18": 18 / 24,
  "14": 14 / 24,
  "12": 12 / 24,
  "9": 9 / 24,
  "875": 875 / 1000,
  "750": 750 / 1000,
  "748": 748 / 1000,
}

const factor = (k: string | null) => {
  if (!k) return 1
  return KARAT_FACTORS[k] ?? Number(k) / 1000
}

// Net diff in karat 875 from supplier perspective:
// (gold to supplier) - (gold from supplier), normalized via pure gold then /0.875
async function computeSupplierDiffs(suppliers: Supplier[]): Promise<SupplierRow[]> {
  const { data: goldMetal } = await supabase.from("metals").select("id").eq("code", "gold").maybeSingle()
  if (!goldMetal) return suppliers.map((s) => ({ ...s, diff_875: 0 }))

  const { data: mv } = await supabase
    .from("movements")
    .select("from_type,from_id,to_type,to_id,karat,weight,metal_id")
    .eq("metal_id", goldMetal.id)

  return suppliers.map((s) => {
    let pure = 0
    for (const r of mv ?? []) {
      const f = factor(r.karat)
      const w = Number(r.weight) * f
      // to supplier => positive (we owe him), from supplier => negative
      if (r.to_type === "supplier" && r.to_id === s.id) pure += w
      if (r.from_type === "supplier" && r.from_id === s.id) pure -= w
    }
    return { ...s, diff_875: pure / 0.875 }
  })
}

export function SuppliersPage() {
  const [rows, setRows] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from("suppliers").select("id,name,phone").order("name")
    const withDiffs = await computeSupplierDiffs((data ?? []) as Supplier[])
    setRows(withDiffs)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const columns: DataTableColumn<SupplierRow>[] = [
    {
      key: "name",
      header: "الاسم",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary-strong">
            <User className="h-4 w-4" />
          </span>
          <span className="font-medium">{r.name}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: "phone",
      header: "رقم الموبايل",
      cell: (r) =>
        r.phone ? (
          <span className="inline-flex items-center gap-1 text-sm tabular-nums" dir="ltr">
            <Phone className="h-3.5 w-3.5" />
            {r.phone}
          </span>
        ) : (
          "-"
        ),
    },
    {
      key: "diff_875",
      header: "فرق الذهب (عيار 875)",
      cell: (r) => {
        const v = r.diff_875
        const sign = v > 0.0001 ? "+" : v < -0.0001 ? "" : ""
        const cls = v > 0.0001 ? "text-emerald-600" : v < -0.0001 ? "text-rose-600" : "text-muted-foreground"
        return (
          <span className={`tabular-nums font-semibold ${cls}`}>
            {sign}
            {v.toLocaleString("ar-EG", { maximumFractionDigits: 3 })} جم
          </span>
        )
      },
      sortable: true,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to={`/suppliers/${r.id}`}>
            <FileText className="h-4 w-4" />
            كشف حساب
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الموردين"
        description="إدارة الموردين وحركات المعادن المرتبطة بهم"
        actions={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            إضافة مورد
          </Button>
        }
      />
      {loading ? (
        <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(r) => r.id}
          searchKeys={["name", "phone"]}
          searchPlaceholder="ابحث عن مورد..."
          onRefresh={load}
          emptyMessage="لا يوجد موردون بعد"
        />
      )}

      <AddSupplierDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
    </div>
  )
}

function AddSupplierDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setPhone("")
    }
  }, [open])

  const submit = async () => {
    if (!name.trim()) return toast.error("ادخل اسم المورد")
    setSaving(true)
    const { error } = await supabase.from("suppliers").insert({ name: name.trim(), phone: phone.trim() || null })
    setSaving(false)
    if (error) return toast.error("فشل إضافة المورد")
    toast.success("تم إضافة المورد")
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة مورد جديد</DialogTitle>
          <DialogDescription>ادخل بيانات المورد الأساسية.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-name">الاسم</Label>
            <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المورد" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-phone">رقم الموبايل</Label>
            <Input
              id="sup-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              dir="ltr"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SuppliersPage