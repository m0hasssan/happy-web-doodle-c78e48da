import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { FileText } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type ShiftRow = {
  id: string
  code: string
  started_at: string
  ended_at: string | null
  started_by_name: string | null
  ended_by_name: string | null
  movements_count: number
}

export function ShiftsPage() {
  const [rows, setRows] = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [{ data: shifts }, { data: mv }] = await Promise.all([
      supabase
        .from("shifts")
        .select("id,code,started_at,ended_at,started_by_name,ended_by_name")
        .order("started_at", { ascending: false }),
      supabase.from("movements").select("shift_id"),
    ])
    const counts = new Map<string, number>()
    for (const m of mv ?? []) {
      if (!m.shift_id) continue
      counts.set(m.shift_id, (counts.get(m.shift_id) ?? 0) + 1)
    }
    setRows(
      ((shifts ?? []) as Omit<ShiftRow, "movements_count">[]).map((s) => ({
        ...s,
        movements_count: counts.get(s.id) ?? 0,
      })),
    )
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const columns: DataTableColumn<ShiftRow>[] = [
    {
      key: "code",
      header: "كود الشيفت",
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortable: true,
    },
    {
      key: "started_at",
      header: "وقت البدء",
      cell: (r) => new Date(r.started_at).toLocaleString("ar-EG"),
      sortable: true,
    },
    {
      key: "ended_at",
      header: "وقت الإنهاء",
      cell: (r) =>
        r.ended_at ? (
          new Date(r.ended_at).toLocaleString("ar-EG")
        ) : (
          <Badge variant="default">مفتوح</Badge>
        ),
    },
    {
      key: "movements_count",
      header: "عدد الحركات",
      cell: (r) => <span className="tabular-nums font-semibold">{r.movements_count}</span>,
      sortable: true,
    },
    { key: "started_by_name", header: "الموظف", cell: (r) => r.started_by_name ?? "-" },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to={`/shifts/${r.id}`}>
            <FileText className="h-4 w-4" />
            تفاصيل الشيفت
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="الشيفتات السابقة" description="جميع الشيفتات وحركاتها" />
      {loading ? (
        <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(r) => r.id}
          searchKeys={["code", "started_by_name", "ended_by_name"]}
          searchPlaceholder="ابحث في الشيفتات..."
          onRefresh={load}
          emptyMessage="لا توجد شيفتات بعد"
        />
      )}
    </div>
  )
}

export default ShiftsPage
