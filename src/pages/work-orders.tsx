import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableSkeleton } from "@/components/loading-skeletons"

export type WorkOrderRow = {
  id: string
  code: string
  from_vault_id: string
  to_section_id: string
  status: "in_progress" | "cancelled" | "delivered"
  temp_returned_to_vault: boolean
  current_holder_type: "vault" | "section" | null
  current_holder_id: string | null
  notes: string | null
  created_at: string
  vault_name: string
  section_name: string
  current_holder_name: string
  total_weight: number
}

export async function fetchWorkOrders(filter?: { vaultId?: string; sectionId?: string }) {
  let q = supabase.from("work_orders").select("*").order("created_at", { ascending: false })
  // Don't pre-filter — we want orders by current holder, not source.
  const [wo, vaults, sections, mv] = await Promise.all([
    q,
    supabase.from("vaults").select("id,name"),
    supabase.from("manufacturing_sections").select("id,name"),
    supabase
      .from("movements")
      .select("work_order_id,weight,from_type,to_type")
      .not("work_order_id", "is", null),
  ])
  const vMap = new Map((vaults.data ?? []).map((v: { id: string; name: string }) => [v.id, v.name]))
  const sMap = new Map((sections.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))
  const totals = new Map<string, number>()
  for (const m of (mv.data ?? []) as {
    work_order_id: string
    weight: number
    from_type: string
    to_type: string
  }[]) {
    // Net current weight = issued (vault->section) - returned (section->vault).
    const w = Number(m.weight)
    if (m.from_type === "vault" && m.to_type === "section") {
      totals.set(m.work_order_id, (totals.get(m.work_order_id) ?? 0) + w)
    } else if (m.from_type === "section" && m.to_type === "vault") {
      totals.set(m.work_order_id, (totals.get(m.work_order_id) ?? 0) - w)
    }
  }
  const all = ((wo.data ?? []) as Omit<WorkOrderRow, "vault_name" | "section_name" | "current_holder_name" | "total_weight">[]).map((r) => {
    const holderName =
      r.current_holder_type === "vault"
        ? vMap.get(r.current_holder_id ?? "") ?? "-"
        : r.current_holder_type === "section"
          ? sMap.get(r.current_holder_id ?? "") ?? "-"
          : "-"
    return {
      ...r,
      vault_name: vMap.get(r.from_vault_id) ?? "-",
      section_name: sMap.get(r.to_section_id) ?? "-",
      current_holder_name: holderName,
      total_weight: totals.get(r.id) ?? 0,
    }
  }) as WorkOrderRow[]
  if (filter?.vaultId) {
    return all.filter((r) => r.current_holder_type === "vault" && r.current_holder_id === filter.vaultId)
  }
  if (filter?.sectionId) {
    return all.filter((r) => r.current_holder_type === "section" && r.current_holder_id === filter.sectionId)
  }
  return all
}

export function workOrderStatusBadge(r: WorkOrderRow) {
  if (r.status === "cancelled") return <Badge variant="destructive">ملغي</Badge>
  if (r.status === "delivered") return <Badge>تم التسليم</Badge>
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant="secondary">تحت التنفيذ</Badge>
      {r.temp_returned_to_vault && (
        <Badge variant="outline" className="border-warning text-warning">مسترد للخزنة</Badge>
      )}
    </div>
  )
}

export function workOrderColumns(): DataTableColumn<WorkOrderRow>[] {
  return [
    { key: "code", header: "الكود", cell: (r) => <span className="font-mono text-xs">{r.code}</span>, sortable: true },
    { key: "vault_name", header: "من الخزنة", cell: (r) => r.vault_name, sortable: true },
    { key: "section_name", header: "إلى القسم", cell: (r) => r.section_name, sortable: true },
    {
      key: "total_weight",
      header: "إجمالي الوزن",
      cell: (r) => <span className="tabular-nums">{r.total_weight.toLocaleString("ar-EG", { maximumFractionDigits: 3 })} جم</span>,
      sortable: true,
    },
    { key: "status", header: "الحالة", cell: (r) => workOrderStatusBadge(r) },
    { key: "created_at", header: "التاريخ", cell: (r) => new Date(r.created_at).toLocaleString("ar-EG"), sortable: true },
    {
      key: "id",
      header: "",
      cell: (r) => (
        <Button asChild variant="outline" size="sm">
          <Link to={`/work-orders/${r.id}`}>التفاصيل</Link>
        </Button>
      ),
    },
  ]
}

export function WorkOrdersPage() {
  const [rows, setRows] = useState<WorkOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    setRows(await fetchWorkOrders())
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])
  const columns = useMemo(() => workOrderColumns(), [])
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="أوامر الشغل" description="جميع أوامر الشغل المنشأة في النظام" />
      {loading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(r) => r.id}
          searchKeys={["code", "vault_name", "section_name"]}
          searchPlaceholder="ابحث في أوامر الشغل..."
          onRefresh={load}
          emptyMessage="لا توجد أوامر شغل بعد"
        />
      )}
    </div>
  )
}

export default WorkOrdersPage