import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Lock } from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"
import { metalClasses } from "@/lib/metal-colors"
import { TableSkeleton } from "@/components/loading-skeletons"

type Metal = { id: string; code: string; name_ar: string; color: string }
type Vault = { id: string; name: string }
type Supplier = { id: string; name: string }
type Category = { id: string; name: string; requires_count: boolean }

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
  category_id: string | null
  count: number | null
  employee_name: string | null
  shift_id: string | null
  created_at: string
  work_order_id: string | null
  // computed
  from_name: string
  to_name: string
  metal_name: string
  metal_code: string
  metal_color: string
  shift_code: string | null
  category_name: string | null
}

export async function fetchMovementRows(filter?: { supplierId?: string; vaultId?: string; sectionId?: string; shiftId?: string }) {
  const [mv, vaults, suppliers, metals, sections, shifts, cats] = await Promise.all([
    supabase.from("movements").select("*").order("created_at", { ascending: false }),
    supabase.from("vaults").select("id,name"),
    supabase.from("suppliers").select("id,name"),
    supabase.from("metals").select("id,code,name_ar,color"),
    supabase.from("manufacturing_sections").select("id,name"),
    supabase.from("shifts").select("id,code"),
    supabase.from("metal_categories").select("id,name,requires_count"),
  ])
  const vMap = new Map((vaults.data ?? []).map((v: Vault) => [v.id, v.name]))
  const sMap = new Map((suppliers.data ?? []).map((s: Supplier) => [s.id, s.name]))
  const secMap = new Map((sections.data ?? []).map((x: { id: string; name: string }) => [x.id, x.name]))
  const mMap = new Map((metals.data ?? []).map((m: Metal) => [m.id, m]))
  const shMap = new Map((shifts.data ?? []).map((s: { id: string; code: string }) => [s.id, s.code]))
  const cMap = new Map((cats.data ?? []).map((c: Category) => [c.id, c.name]))
  let rows = (mv.data ?? []) as Omit<MovementRow, "from_name" | "to_name" | "metal_name" | "metal_code" | "metal_color" | "shift_code" | "category_name">[]
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
      category_name: r.category_id ? cMap.get(r.category_id) ?? null : null,
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
      key: "category_name",
      header: "التصنيف",
      cell: (r) => (r.category_name ? <Badge variant="secondary">{r.category_name}</Badge> : "-"),
    },
    {
      key: "weight",
      header: "الوزن",
      cell: (r) => <span className="tabular-nums">{Number(r.weight).toLocaleString("ar-EG", { maximumFractionDigits: 3 })} جم</span>,
      sortable: true,
    },
    {
      key: "count",
      header: "العدد",
      cell: (r) => (r.count != null ? <span className="tabular-nums">{r.count}</span> : "-"),
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
  const { hasPermission, isAdmin, permissions, loading: permLoading } = usePermissions()
  const canView = hasPermission("view_movements")
  // ملاحظة: تعديل/حذف القيود مقفولان حالياً على مستوى الواجهة

  const load = async () => {
    setLoading(true)
    const all = await fetchMovementRows()
    if (isAdmin) {
      setRows(all)
    } else {
      const allowedVaults = new Set(
        permissions
          .filter((p) => p.permission === "view_vault_movements" && p.resource_id)
          .map((p) => p.resource_id as string),
      )
      const allowedSections = new Set(
        permissions
          .filter((p) => p.permission === "view_section_movements" && p.resource_id)
          .map((p) => p.resource_id as string),
      )
      setRows(
        all.filter((r) => {
          const isAllowedSide = (t: string, id: string) =>
            (t === "vault" && allowedVaults.has(id)) ||
            (t === "section" && allowedSections.has(id)) ||
            t === "supplier"
          return isAllowedSide(r.from_type, r.from_id) || isAllowedSide(r.to_type, r.to_id)
        }),
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, permissions.length])

  const columns = useMemo(() => movementColumns(), [])

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
      <PageHeader title="قيود الحركة" description="سجل جميع حركات المعادن داخل النظام" />
      {loading ? (
        <TableSkeleton rows={6} columns={6} />
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
  )
}

export default MovementsPage