import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { metalClasses } from "@/lib/metal-colors"

type Metal = { id: string; code: string; name_ar: string; color: string }
type Vault = { id: string; name: string }
type Supplier = { id: string; name: string }

export type MovementRow = {
  id: string
  code: string
  from_type: "vault" | "supplier" | "section"
  from_id: string
  to_type: "vault" | "supplier" | "section"
  to_id: string
  metal_id: string
  karat: string | null
  weight: number
  employee_name: string | null
  shift_id: string | null
  created_at: string
  // computed
  from_name: string
  to_name: string
  metal_name: string
  metal_code: string
  metal_color: string
  shift_code: string | null
}

export async function fetchMovementRows(filter?: { supplierId?: string; vaultId?: string; sectionId?: string; shiftId?: string }) {
  const [mv, vaults, suppliers, metals, sections, shifts] = await Promise.all([
    supabase.from("movements").select("*").order("created_at", { ascending: false }),
    supabase.from("vaults").select("id,name"),
    supabase.from("suppliers").select("id,name"),
    supabase.from("metals").select("id,code,name_ar,color"),
    supabase.from("manufacturing_sections").select("id,name"),
    supabase.from("shifts").select("id,code"),
  ])
  const vMap = new Map((vaults.data ?? []).map((v: Vault) => [v.id, v.name]))
  const sMap = new Map((suppliers.data ?? []).map((s: Supplier) => [s.id, s.name]))
  const secMap = new Map((sections.data ?? []).map((x: { id: string; name: string }) => [x.id, x.name]))
  const mMap = new Map((metals.data ?? []).map((m: Metal) => [m.id, m]))
  const shMap = new Map((shifts.data ?? []).map((s: { id: string; code: string }) => [s.id, s.code]))
  let rows = (mv.data ?? []) as Omit<MovementRow, "from_name" | "to_name" | "metal_name" | "metal_code" | "metal_color" | "shift_code">[]
  if (filter?.supplierId) {
    rows = rows.filter(
      (r) =>
        (r.from_type === "supplier" && r.from_id === filter.supplierId) ||
        (r.to_type === "supplier" && r.to_id === filter.supplierId),
    )
  }
  if (filter?.vaultId) {
    rows = rows.filter(
      (r) =>
        (r.from_type === "vault" && r.from_id === filter.vaultId) ||
        (r.to_type === "vault" && r.to_id === filter.vaultId),
    )
  }
  if (filter?.sectionId) {
    rows = rows.filter(
      (r) =>
        (r.from_type === "section" && r.from_id === filter.sectionId) ||
        (r.to_type === "section" && r.to_id === filter.sectionId),
    )
  }
  if (filter?.shiftId) {
    rows = rows.filter((r) => r.shift_id === filter.shiftId)
  }
  return rows.map((r) => {
    const m = mMap.get(r.metal_id)
    const lookup = (t: string, id: string) =>
      t === "vault" ? vMap.get(id) : t === "supplier" ? sMap.get(id) : secMap.get(id)
    const fromName = lookup(r.from_type, r.from_id)
    const toName = lookup(r.to_type, r.to_id)
    return {
      ...r,
      from_name: fromName ?? "-",
      to_name: toName ?? "-",
      metal_name: m?.name_ar ?? "-",
      metal_code: m?.code ?? "",
      metal_color: m?.color ?? "",
      shift_code: r.shift_id ? shMap.get(r.shift_id) ?? null : null,
    } as MovementRow
  })
}

export function movementColumns(): DataTableColumn<MovementRow>[] {
  return [
    { key: "code", header: "كود الحركة", cell: (r) => <span className="font-mono text-xs">{r.code}</span>, sortable: true },
    {
      key: "shift_code",
      header: "كود الشيفت",
      cell: (r) =>
        r.shift_code ? (
          <span className="font-mono text-xs text-muted-foreground">{r.shift_code}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    { key: "from_name", header: "من", cell: (r) => r.from_name, sortable: true },
    { key: "to_name", header: "إلى", cell: (r) => r.to_name, sortable: true },
    {
      key: "metal_name",
      header: "المعدن",
      cell: (r) => {
        const c = metalClasses(r.metal_color || r.metal_code)
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