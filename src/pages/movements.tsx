import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { metalClasses } from "@/lib/metal-colors"

type Metal = { id: string; code: string; name_ar: string }
type Vault = { id: string; name: string }
type Supplier = { id: string; name: string }

export type MovementRow = {
  id: string
  code: string
  from_type: "vault" | "supplier"
  from_id: string
  to_type: "vault" | "supplier"
  to_id: string
  metal_id: string
  karat: string | null
  weight: number
  employee_name: string | null
  created_at: string
  // computed
  from_name: string
  to_name: string
  metal_name: string
  metal_code: string
}

export async function fetchMovementRows(filter?: { supplierId?: string }) {
  const [mv, vaults, suppliers, metals] = await Promise.all([
    supabase.from("movements").select("*").order("created_at", { ascending: false }),
    supabase.from("vaults").select("id,name"),
    supabase.from("suppliers").select("id,name"),
    supabase.from("metals").select("id,code,name_ar"),
  ])
  const vMap = new Map((vaults.data ?? []).map((v: Vault) => [v.id, v.name]))
  const sMap = new Map((suppliers.data ?? []).map((s: Supplier) => [s.id, s.name]))
  const mMap = new Map((metals.data ?? []).map((m: Metal) => [m.id, m]))
  let rows = (mv.data ?? []) as Omit<MovementRow, "from_name" | "to_name" | "metal_name" | "metal_code">[]
  if (filter?.supplierId) {
    rows = rows.filter(
      (r) =>
        (r.from_type === "supplier" && r.from_id === filter.supplierId) ||
        (r.to_type === "supplier" && r.to_id === filter.supplierId),
    )
  }
  return rows.map((r) => {
    const m = mMap.get(r.metal_id)
    const fromName = r.from_type === "vault" ? vMap.get(r.from_id) : sMap.get(r.from_id)
    const toName = r.to_type === "vault" ? vMap.get(r.to_id) : sMap.get(r.to_id)
    return {
      ...r,
      from_name: fromName ?? "-",
      to_name: toName ?? "-",
      metal_name: m?.name_ar ?? "-",
      metal_code: m?.code ?? "",
    } as MovementRow
  })
}

export function movementColumns(): DataTableColumn<MovementRow>[] {
  return [
    { key: "code", header: "كود الحركة", cell: (r) => <span className="font-mono text-xs">{r.code}</span>, sortable: true },
    { key: "from_name", header: "من", cell: (r) => r.from_name, sortable: true },
    { key: "to_name", header: "إلى", cell: (r) => r.to_name, sortable: true },
    {
      key: "metal_name",
      header: "المعدن",
      cell: (r) => {
        const c = metalClasses(r.metal_code)
        return <span className={`font-medium ${c.text}`}>{r.metal_name}</span>
      },
    },
    { key: "karat", header: "العيار", cell: (r) => (r.karat ? <Badge variant="outline">{r.karat}</Badge> : "-") },
    {
      key: "weight",
      header: "الوزن",
      cell: (r) => <span className="tabular-nums">{Number(r.weight).toLocaleString("ar-EG", { maximumFractionDigits: 3 })} جم</span>,
      sortable: true,
    },
    { key: "employee_name", header: "القائم بالحركة", cell: (r) => r.employee_name ?? "-" },
    {
      key: "created_at",
      header: "الوقت",
      cell: (r) => new Date(r.created_at).toLocaleString("ar-EG"),
      sortable: true,
    },
  ]
}

export function MovementsPage() {
  const [rows, setRows] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setRows(await fetchMovementRows())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const columns = useMemo(() => movementColumns(), [])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="قيود الحركة" description="سجل جميع حركات المعادن داخل النظام" />
      {loading ? (
        <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(r) => r.id}
          searchKeys={["code", "from_name", "to_name", "metal_name", "employee_name"]}
          searchPlaceholder="ابحث في الحركات..."
          onRefresh={load}
          emptyMessage="لا توجد حركات بعد"
        />
      )}
    </div>
  )
}

export default MovementsPage