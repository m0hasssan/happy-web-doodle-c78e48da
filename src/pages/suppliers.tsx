import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, FileText, User, Lock } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { TableSkeleton } from "@/components/loading-skeletons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { SupplierActions } from "@/components/supplier-actions"
import { usePermissions } from "@/hooks/use-permissions"
import { formatWeight } from "@/lib/number-format"
import { convertWeightToKarat } from "@/lib/karat-convert"

type Supplier = { id: string; code: string; name: string }

type SupplierRow = Supplier & {
  inflow_gold: number
  outflow_gold: number
  diff_gold: number
}

async function computeSupplierDiffs(
  suppliers: Supplier[],
): Promise<{ rows: SupplierRow[]; primaryKarat: string }> {
  const { data: metals } = await supabase
    .from("metals")
    .select("id,code,primary_report_karat")
  const gold = metals?.find((m) => m.code === "gold")
  const goldId = gold?.id
  const primaryKarat = gold?.primary_report_karat ?? "999"

  const { data: mv } = await supabase
    .from("movements")
    .select("from_type,from_id,to_type,to_id,karat,weight,metal_id")

  const rows = suppliers.map((s) => {
    let inflow = 0
    let outflow = 0
    for (const r of mv ?? []) {
      if (r.metal_id !== goldId) continue
      const w = convertWeightToKarat(Number(r.weight), r.karat, primaryKarat)
      if (r.from_type === "supplier" && r.from_id === s.id) inflow += w
      else if (r.to_type === "supplier" && r.to_id === s.id) outflow += w
    }
    return {
      ...s,
      inflow_gold: inflow,
      outflow_gold: outflow,
      diff_gold: outflow - inflow,
    }
  })
  return { rows, primaryKarat }
}

const diffCell = (v: number) => {
  const sign = v > 0.0001 ? "+" : ""
  const cls =
    v > 0.0001 ? "text-emerald-600" : v < -0.0001 ? "text-rose-600" : "text-muted-foreground"
  return (
    <span className={`tabular-nums font-semibold ${cls}`}>
      {sign}
      {formatWeight(v)} جم
    </span>
  )
}

export function SuppliersPage() {
  const { hasPermission, loading: permLoading } = usePermissions()
  const canView = hasPermission("view_suppliers")
  const canCreate = hasPermission("create_supplier")
  const canAccount = hasPermission("view_supplier_account")
  const canEdit = hasPermission("edit_supplier")
  const canDelete = hasPermission("delete_supplier")
  const [rows, setRows] = useState<SupplierRow[]>([])
  const [primaryKarat, setPrimaryKarat] = useState<string>("999")
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from("suppliers").select("id,code,name").order("name")
    const { rows: withDiffs, primaryKarat: pk } = await computeSupplierDiffs(
      (data ?? []) as Supplier[],
    )
    setRows(withDiffs)
    setPrimaryKarat(pk)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const columns: DataTableColumn<SupplierRow>[] = [
    {
      key: "code",
      header: "الكود",
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortable: true,
    },
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
      key: "inflow_gold",
      header: `إجمالي الداخل (${primaryKarat})`,
      cell: (r) => (
        <span className="tabular-nums font-semibold text-rose-600">
          {formatWeight(r.inflow_gold)} جم
        </span>
      ),
      sortable: true,
    },
    {
      key: "outflow_gold",
      header: `إجمالي الخارج (${primaryKarat})`,
      cell: (r) => (
        <span className="tabular-nums font-semibold text-emerald-600">
          {formatWeight(r.outflow_gold)} جم
        </span>
      ),
      sortable: true,
    },
    {
      key: "diff_gold",
      header: `فرق الذهب (${primaryKarat})`,
      cell: (r) => diffCell(r.diff_gold),
      sortable: true,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          {canAccount && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to={`/suppliers/${r.id}`}>
                <FileText className="h-4 w-4" />
                كشف حساب
              </Link>
            </Button>
          )}
          {(canEdit || canDelete) && (
            <SupplierActions
              supplierId={r.id}
              supplierName={r.name}
              onChanged={load}
              onDeleted={load}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}
        </div>
      ),
    },
  ]

  return (
    !permLoading && !canView ? (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">لا تملك الصلاحية</h2>
          </CardContent>
        </Card>
      </div>
    ) : (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الموردين"
        description="إدارة الموردين وحركات المعادن المرتبطة بهم"
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              إضافة مورد
            </Button>
          ) : null
        }
      />
      {loading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(r) => r.id}
          searchKeys={["code", "name"]}
          searchPlaceholder="ابحث عن مورد..."
          onRefresh={load}
          emptyMessage="لا يوجد موردون بعد"
        />
      )}

      <AddSupplierDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
    </div>
    )
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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName("")
  }, [open])

  const submit = async () => {
    if (!name.trim()) return toast.error("ادخل اسم المورد")
    setSaving(true)
    const { error } = await supabase.from("suppliers").insert([{ name: name.trim() }])
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
          <DialogDescription>ادخل اسم المورد.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-name">الاسم</Label>
            <Input
              id="sup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المورد"
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
