import { useEffect, useState } from "react"
import { ChevronLeft, Coins } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Metal = { id: string; code: string; name_ar: string; enabled: boolean }

export function SystemSettingsPage() {
  const [view, setView] = useState<"index" | "metals">("index")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إعدادات النظام"
        description="ضبط الإعدادات العامة للنظام"
        actions={
          view !== "index" ? (
            <Button variant="outline" className="gap-2" onClick={() => setView("index")}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              رجوع
            </Button>
          ) : null
        }
      />

      {view === "index" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setView("metals")}
            className="text-start"
          >
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                  <Coins className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">تحديد المعادن</h3>
                  <p className="text-sm text-muted-foreground">
                    تفعيل أو تعطيل أنواع المعادن
                  </p>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      {view === "metals" && <MetalsSettings />}
    </div>
  )
}

function MetalsSettings() {
  const [metals, setMetals] = useState<Metal[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from("metals").select("*").order("name_ar")
    setMetals((data ?? []) as Metal[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = async (m: Metal) => {
    const next = !m.enabled
    setMetals((arr) => arr.map((x) => (x.id === m.id ? { ...x, enabled: next } : x)))
    const { error } = await supabase.from("metals").update({ enabled: next }).eq("id", m.id)
    if (error) {
      toast.error("فشل التحديث")
      load()
    } else {
      toast.success("تم التحديث")
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : (
          metals.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Coins className="h-5 w-5 text-primary-strong" />
                <span className="font-medium">{m.name_ar}</span>
              </div>
              <Switch checked={m.enabled} onCheckedChange={() => toggle(m)} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export default SystemSettingsPage