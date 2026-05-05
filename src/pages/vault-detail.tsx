import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowRight, Vault as VaultIcon, Plus, Check, ChevronsUpDown } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { metalClasses } from "@/lib/metal-colors"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { fetchMovementRows, movementColumns, type MovementRow } from "./movements"

type Vault = { id: string; name: string; status: string }
type Metal = { id: string; code: string; name_ar: string }
type InvRow = { metal_id: string; total_weight: number; karat: string | null }
type Supplier = { id: string; name: string }

export function VaultDetailPage() {
  const { vaultId } = useParams<{ vaultId: string }>()
  const [vault, setVault] = useState<Vault | null>(null)
  const [metals, setMetals] = useState<Metal[]>([])
  const [rows, setRows] = useState<InvRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const load = async () => {
    if (!vaultId) return
    setLoading(true)
    const [v, m, inv, vm, mv] = await Promise.all([
      supabase.from("vaults").select("id,name,status").eq("id", vaultId).single(),
      supabase.from("metals").select("id,code,name_ar").eq("enabled", true),
      supabase.from("vault_inventory").select("metal_id,total_weight,karat").eq("vault_id", vaultId),
      supabase.from("vault_metals").select("metal_id").eq("vault_id", vaultId),
      fetchMovementRows({ vaultId }),
    ])
    const allowedIds = new Set((vm.data ?? []).map((x) => x.metal_id))
    setVault((v.data ?? null) as Vault | null)
    setMetals(((m.data ?? []) as Metal[]).filter((mm) => allowedIds.has(mm.id)))
    setRows((inv.data ?? []) as InvRow[])
    setMovements(mv)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultId])

  const cards = rows
    .filter((r) => Number(r.total_weight) > 0)
    .map((r) => ({
      ...r,
      metal: metals.find((m) => m.id === r.metal_id),
    }))
    .filter((r) => r.metal)

  const isActive = vault?.status === "active"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={vault?.name ?? "الخزنة"}
        description="تفاصيل الأوزان الموجودة في الخزنة"
        actions={
          <div className="flex items-center gap-2">
            {vault && (
              <Badge variant={vault.status === "active" ? "default" : "secondary"}>
                {vault.status === "active" ? "نشطة" : "معطلة"}
              </Badge>
            )}
            <Button
              className="gap-2"
              onClick={() => setAddOpen(true)}
              disabled={!isActive}
            >
              <Plus className="h-4 w-4" />
              قيد دخول
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/vaults">
                <ArrowRight className="h-4 w-4" />
                رجوع
              </Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <>
          {cards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <VaultIcon className="h-10 w-10" />
                <p>الخزنة فارغة</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c, i) => {
            const cls = metalClasses(c.metal!.code)
            return (
              <Card key={i} size="sm" className={`${cls.bg} ${cls.border} border`}>
                <CardContent className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${cls.text}`}>{c.metal!.name_ar}</span>
                    {c.karat && (
                      <Badge variant="outline" className={`${cls.text} ${cls.border}`}>
                        عيار {c.karat}
                      </Badge>
                    )}
                  </div>
                  <div className={`text-xl font-bold tabular-nums ${cls.text}`}>
                    {Number(c.total_weight).toLocaleString("ar-EG", { maximumFractionDigits: 3 })}
                    <span className="ms-1 text-xs font-normal opacity-70">جم</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">حركات الخزنة</h2>
            <DataTable
              data={movements}
              columns={movementColumns()}
              rowKey={(r) => r.id}
              searchKeys={["code", "from_name", "to_name", "metal_name", "employee_name"]}
              searchPlaceholder="ابحث في حركات الخزنة..."
              onRefresh={load}
              emptyMessage="لا توجد حركات لهذه الخزنة بعد"
            />
          </div>
        </>
      )}

      {vault && (
        <AddInflowDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          vault={vault}
          metals={metals}
          onCreated={load}
        />
      )}
    </div>
  )
}

function AddInflowDialog({
  open,
  onOpenChange,
  vault,
  metals,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  vault: Vault
  metals: Metal[]
  onCreated: () => void
}) {
  const { displayName } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState<string>("")
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [metalId, setMetalId] = useState<string>("")
  const [karat, setKarat] = useState("")
  const [weight, setWeight] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSupplierId("")
    setMetalId(metals[0]?.id ?? "")
    setKarat("")
    setWeight("")
    supabase
      .from("suppliers")
      .select("id,name")
      .order("name")
      .then(({ data }) => setSuppliers((data ?? []) as Supplier[]))
  }, [open, metals])

  const supplier = suppliers.find((s) => s.id === supplierId)

  const submit = async () => {
    if (!supplierId) return toast.error("اختر المورد")
    if (!metalId) return toast.error("اختر نوع المعدن")
    if (!karat.trim()) return toast.error("ادخل العيار")
    const w = Number(weight)
    if (!w || w <= 0) return toast.error("ادخل وزناً صحيحاً")

    setSaving(true)
    // 1) Insert movement
    const { error: mvErr } = await supabase.from("movements").insert({
      from_type: "supplier",
      from_id: supplierId,
      to_type: "vault",
      to_id: vault.id,
      metal_id: metalId,
      karat: karat.trim(),
      weight: w,
      employee_name: displayName,
    })
    if (mvErr) {
      setSaving(false)
      return toast.error("فشل تسجيل الحركة")
    }

    // 2) Upsert inventory (find existing row by vault+metal+karat)
    const { data: existing } = await supabase
      .from("vault_inventory")
      .select("id,total_weight")
      .eq("vault_id", vault.id)
      .eq("metal_id", metalId)
      .eq("karat", karat.trim())
      .maybeSingle()

    if (existing) {
      await supabase
        .from("vault_inventory")
        .update({ total_weight: Number(existing.total_weight) + w })
        .eq("id", existing.id)
    } else {
      await supabase.from("vault_inventory").insert({
        vault_id: vault.id,
        metal_id: metalId,
        karat: karat.trim(),
        total_weight: w,
      })
    }

    setSaving(false)
    toast.success("تم تسجيل قيد الدخول")
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>قيد دخول جديد</DialogTitle>
          <DialogDescription>
            تسجيل دخول معدن إلى خزنة «{vault.name}» من أحد الموردين.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>المورد</Label>
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="justify-between"
                >
                  {supplier?.name ?? "اختر المورد..."}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                  <CommandInput placeholder="ابحث عن مورد..." />
                  <CommandList>
                    <CommandEmpty>لا يوجد موردون</CommandEmpty>
                    <CommandGroup>
                      {suppliers.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => {
                            setSupplierId(s.id)
                            setSupplierOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              supplierId === s.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-2">
            <Label>نوع المعدن</Label>
            <Select value={metalId} onValueChange={setMetalId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المعدن" />
              </SelectTrigger>
              <SelectContent>
                {metals.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="karat">العيار</Label>
              <Input
                id="karat"
                value={karat}
                onChange={(e) => setKarat(e.target.value)}
                placeholder="مثال: 875"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight">الوزن (جم)</Label>
              <Input
                id="weight"
                type="number"
                step="0.001"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.000"
                dir="ltr"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            حفظ القيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default VaultDetailPage
