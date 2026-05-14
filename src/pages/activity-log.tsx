import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableSkeleton } from "@/components/loading-skeletons"
import { Eye, RefreshCw } from "lucide-react"

type LogRow = {
  id: string
  created_at: string
  user_id: string | null
  user_name: string | null
  action: "INSERT" | "UPDATE" | "DELETE"
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

const TABLE_LABELS: Record<string, string> = {
  vaults: "الخزن",
  vault_inventory: "مخزون الخزنة",
  vault_metals: "معادن الخزنة",
  vault_item_adjustments: "تعديل أصناف الخزنة",
  manufacturing_sections: "أقسام التصنيع",
  section_inventory: "مخزون القسم",
  section_metals: "معادن القسم",
  section_settings: "إعدادات القسم",
  section_metal_rules: "قواعد معادن القسم",
  section_shrinkage_inventory: "خسيات القسم",
  movements: "قيود الحركة",
  suppliers: "الموردين",
  work_orders: "أوامر الشغل",
  work_order_shrinkage: "خسيات أمر الشغل",
  shifts: "الشيفتات",
  metals: "المعادن",
  metal_karats: "العيارات",
  metal_categories: "التصنيفات",
  user_roles: "أدوار المستخدمين",
  user_permissions: "صلاحيات المستخدمين",
  profiles: "بيانات المستخدمين",
  system_settings: "إعدادات النظام",
  recovery_operations: "عمليات الاسترداد",
  recovery_entries: "قيود الاسترداد",
  recovery_operation_sections: "أقسام الاسترداد",
}

const ACTION_LABELS: Record<string, string> = {
  INSERT: "إضافة",
  UPDATE: "تعديل",
  DELETE: "حذف",
}

function actionVariant(action: string): "default" | "secondary" | "destructive" {
  if (action === "INSERT") return "default"
  if (action === "DELETE") return "destructive"
  return "secondary"
}

function formatDateTime(s: string): string {
  try {
    const d = new Date(s)
    return d.toLocaleString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return s
  }
}

const PAGE_SIZE = 50

export default function ActivityLogPage() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [tableFilter, setTableFilter] = useState<string>("all")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<LogRow | null>(null)

  const load = async () => {
    setLoading(true)
    let q = supabase
      .from("activity_log" as never)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (tableFilter !== "all") q = q.eq("table_name", tableFilter)
    if (actionFilter !== "all") q = q.eq("action", actionFilter)
    const { data, count } = await q
    setRows((data ?? []) as unknown as LogRow[])
    setTotal(count ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tableFilter, actionFilter])

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const s = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (r.user_name ?? "").toLowerCase().includes(s) ||
        (TABLE_LABELS[r.table_name] ?? r.table_name).toLowerCase().includes(s) ||
        (r.record_id ?? "").toLowerCase().includes(s),
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <PageHeader
        title="سجل النشاطات"
        description="كل العمليات التي تتم على النظام (إضافة، تعديل، حذف)"
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="بحث (المستخدم / الجدول / المعرف)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0) }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="نوع العملية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل العمليات</SelectItem>
                <SelectItem value="INSERT">إضافة</SelectItem>
                <SelectItem value="UPDATE">تعديل</SelectItem>
                <SelectItem value="DELETE">حذف</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v); setPage(0) }}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="القسم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأقسام</SelectItem>
                {Object.entries(TABLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              تحديث
            </Button>
            <div className="ms-auto text-xs text-muted-foreground">
              إجمالي: {total.toLocaleString("ar-EG")}
            </div>
          </div>

          {loading ? (
            <TableSkeleton />
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              لا توجد نشاطات
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-right">
                    <th className="p-2 font-medium">الوقت</th>
                    <th className="p-2 font-medium">المستخدم</th>
                    <th className="p-2 font-medium">العملية</th>
                    <th className="p-2 font-medium">القسم</th>
                    <th className="p-2 font-medium">المعرف</th>
                    <th className="p-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="p-2 whitespace-nowrap text-xs" dir="ltr">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="p-2">{r.user_name ?? "—"}</td>
                      <td className="p-2">
                        <Badge variant={actionVariant(r.action)}>
                          {ACTION_LABELS[r.action] ?? r.action}
                        </Badge>
                      </td>
                      <td className="p-2">{TABLE_LABELS[r.table_name] ?? r.table_name}</td>
                      <td className="p-2 text-xs font-mono text-muted-foreground" dir="ltr">
                        {r.record_id ? r.record_id.slice(0, 8) : "—"}
                      </td>
                      <td className="p-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(r)}>
                          <Eye className="h-4 w-4" />
                          تفاصيل
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                السابق
              </Button>
              <div className="text-xs text-muted-foreground">
                صفحة {page + 1} من {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>تفاصيل النشاط</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">الوقت</div>
                  <div dir="ltr">{formatDateTime(selected.created_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">المستخدم</div>
                  <div>{selected.user_name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">العملية</div>
                  <Badge variant={actionVariant(selected.action)}>
                    {ACTION_LABELS[selected.action] ?? selected.action}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">القسم</div>
                  <div>{TABLE_LABELS[selected.table_name] ?? selected.table_name}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">المعرف</div>
                  <div className="font-mono text-xs" dir="ltr">{selected.record_id ?? "—"}</div>
                </div>
              </div>

              {selected.action === "UPDATE" && selected.old_data && selected.new_data ? (
                <DiffView oldData={selected.old_data} newData={selected.new_data} />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {selected.old_data && (
                    <div>
                      <div className="text-xs font-medium mb-1">قبل</div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-80" dir="ltr">
                        {JSON.stringify(selected.old_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selected.new_data && (
                    <div>
                      <div className="text-xs font-medium mb-1">بعد</div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-80" dir="ltr">
                        {JSON.stringify(selected.new_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DiffView({
  oldData,
  newData,
}: {
  oldData: Record<string, unknown>
  newData: Record<string, unknown>
}) {
  const keys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
  const changed = keys.filter((k) => JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]))
  if (changed.length === 0) {
    return <div className="text-sm text-muted-foreground">لا توجد تغييرات.</div>
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr className="text-right">
            <th className="p-2 font-medium">الحقل</th>
            <th className="p-2 font-medium">قبل</th>
            <th className="p-2 font-medium">بعد</th>
          </tr>
        </thead>
        <tbody>
          {changed.map((k) => (
            <tr key={k} className="border-t">
              <td className="p-2 font-mono" dir="ltr">{k}</td>
              <td className="p-2 font-mono text-destructive" dir="ltr">
                {JSON.stringify(oldData[k])}
              </td>
              <td className="p-2 font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
                {JSON.stringify(newData[k])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}