import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"

export function SupplierDetailPage() {
  const { supplierId } = useParams<{ supplierId: string }>()
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`كشف حساب: ${name || "..."}`}
        description="جميع الحركات المرتبطة بهذا المورد"
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/suppliers">
              <ArrowRight className="h-4 w-4" />
              العودة للموردين
            </Link>
          </Button>
        }
      />
      {loading ? (
        <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
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