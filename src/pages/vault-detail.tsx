import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowRight, Vault as VaultIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type Vault = { id: string; name: string; status: string }
type Metal = { id: string; code: string; name_ar: string }
type InvRow = { metal_id: string; total_weight: number; karat: string | null }

export function VaultDetailPage() {
  const { vaultId } = useParams<{ vaultId: string }>()
  const [vault, setVault] = useState<Vault | null>(null)
  const [metals, setMetals] = useState<Metal[]>([])
  const [rows, setRows] = useState<InvRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!vaultId) return
      setLoading(true)
      const [v, m, inv] = await Promise.all([
        supabase.from("vaults").select("id,name,status").eq("id", vaultId).single(),
        supabase.from("metals").select("id,code,name_ar"),
        supabase.from("vault_inventory").select("metal_id,total_weight,karat").eq("vault_id", vaultId),
      ])
      setVault((v.data ?? null) as Vault | null)
      setMetals((m.data ?? []) as Metal[])
      setRows((inv.data ?? []) as InvRow[])
      setLoading(false)
    }
    load()
  }, [vaultId])

  const cards = rows
    .filter((r) => Number(r.total_weight) > 0)
    .map((r) => ({
      ...r,
      metal: metals.find((m) => m.id === r.metal_id),
    }))
    .filter((r) => r.metal)

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
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <VaultIcon className="h-10 w-10" />
            <p>الخزنة فارغة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c, i) => (
            <Card key={i} size="sm">
              <CardContent className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{c.metal!.name_ar}</span>
                  {c.karat && (
                    <Badge variant="outline" className="text-primary-strong">
                      عيار {c.karat}
                    </Badge>
                  )}
                </div>
                <div className="text-xl font-bold tabular-nums text-primary-strong">
                  {Number(c.total_weight).toLocaleString("ar-EG", { maximumFractionDigits: 3 })}
                  <span className="ms-1 text-xs font-normal text-muted-foreground">جم</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default VaultDetailPage
