import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowDownToLine, ArrowUpFromLine, Scale } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"
import { SupplierActions } from "@/components/supplier-actions"
import { TableSkeleton } from "@/components/loading-skeletons"
import { formatNumber } from "@/lib/number-format"
import { usePermissions } from "@/hooks/use-permissions"

const KARAT_FACTORS: Record<string, number> = {
  "999": 999 / 1000, "995": 995 / 1000, "24": 1,
  "22": 22 / 24, "21": 21 / 24, "18": 18 / 24,
  "14": 14 / 24, "12": 12 / 24, "9": 9 / 24,
  "875": 875 / 1000, "750": 750 / 1000, "748": 748 / 1000,
}
const factor = (k: string | null) => (k ? KARAT_FACTORS[k] ?? Number(k) / 1000 : 1)
const fmt = (n: number) =>
  formatNumber(n, { decimals: 3, alwaysShowDecimals: true })

type MetalStats = {
  inflow: number
  outflow: number
  diff: number
}

function MetalKpis({
  title,
  unitLabel,
  stats,
}: {
  title: string
  unitLabel: string
  stats: MetalStats
}) {
  const diffCls =
    stats.diff > 0.0001
      ? "text-emerald-600"
      : stats.diff < -0.0001
        ? "text-rose-600"
        : "text-muted-foreground"
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">إجمالي الداخل ({unitLabel})</span>
              <span className="text-xl font-bold tabular-nums text-rose-600">
                {fmt(stats.inflow)} <span className="text-xs font-normal opacity-70">جم</span>
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">إجمالي الخارج ({unitLabel})</span>
              <span className="text-xl font-bold tabular-nums text-emerald-600">
                {fmt(stats.outflow)} <span className="text-xs font-normal opacity-70">جم</span>
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <ArrowUpFromLine className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                الفرق ({unitLabel}) — {stats.diff > 0.0001 ? "ليا" : stats.diff < -0.0001 ? "عليا" : "متعادل"}
              </span>
              <span className={`text-xl font-bold tabular-nums ${diffCls}`}>
                {stats.diff > 0.0001 ? "+" : ""}
                {fmt(stats.diff)} <span className="text-xs font-normal opacity-70">جم</span>
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
              <Scale className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function SupplierDetailPage() {
  const { supplierId } = useParams<{ supplierId: string }>()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("edit_supplier")
  const canDelete = hasPermission("delete_supplier")
  const [name, setName] = useState("")
  const [rows, setRows] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!supplierId) return
    setLoading(true)
    const [{ data: sup }, mvRows] = await Promise.all([
      supabase.from("suppliers").select("name").eq("id", supplierId).maybeSingle(),
      fetchMovementRows({ supplierId }),
    ])
    setName(sup?.name ?? "")
    setRows(mvRows)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId])

  const computePure = (metalCode: string, normalizeKarat: number | null): MetalStats => {
    let inflow = 0
    let outflow = 0
    for (const r of rows) {
      if (r.metal_code !== metalCode) continue
      const w = Number(r.weight)
      const value = normalizeKarat != null ? (w * factor(r.karat)) / (normalizeKarat / 1000) : w
      if (r.from_type === "supplier") inflow += value
      if (r.to_type === "supplier") outflow += value
    }
    return { inflow, outflow, diff: outflow - inflow }
  }

  const goldStats = computePure("gold", 999)
  const silverStats = computePure("silver", 999)
  const copperStats = computePure("copper", null)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`كشف حساب: ${name || "..."}`}
        description="جميع الحركات المرتبطة بهذا المورد"
        backTo="/suppliers"
        backLabel="العودة للموردين"
        breadcrumbs={[
          { label: "لوحة التحكم", to: "/control-panel" },
          { label: "الموردين", to: "/suppliers" },
          { label: name || "مورد" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {supplierId && (
              (canEdit || canDelete) && (
                <SupplierActions
                  supplierId={supplierId}
                  supplierName={name}
                  onChanged={load}
                  onDeleted={() => navigate("/suppliers")}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              )
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        <MetalKpis title="الذهب" unitLabel="عيار 999" stats={goldStats} />
        <MetalKpis title="الفضة" unitLabel="عيار 999" stats={silverStats} />
        <MetalKpis title="النحاس" unitLabel="إجمالي" stats={copperStats} />
      </div>

      {loading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (
        <DataTable
          data={rows}
          columns={movementColumns()}
          rowKey={(r) => r.id}
          searchKeys={["code", "from_name", "to_name", "metal_name", "employee_name"]}
          searchPlaceholder="ابحث في حركات المورد..."
          onRefresh={load}
          emptyMessage="لا توجد حركات لهذا المورد"
        />
      )}
    </div>
  )
}

export default SupplierDetailPage