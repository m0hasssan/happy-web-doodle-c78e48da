import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DEFAULT_SETTINGS,
  loadSectionRules,
  type MetalRule,
  type SectionSettings,
} from "@/lib/section-rules"

type Metal = { id: string; name_ar: string }
type Karat = { metal_id: string; karat: string }

export function SectionSettingsDialog({
  open,
  onOpenChange,
  sectionId,
  sectionName,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  sectionId: string | null
  sectionName?: string
  onSaved?: () => void
}) {
  const [metals, setMetals] = useState<Metal[]>([])
  const [karats, setKarats] = useState<Karat[]>([])
  const [settings, setSettings] = useState<SectionSettings | null>(null)
  // Map<key, allowed> where key = `${metalId}|${karat ?? ""}|${direction}`
  const [ruleMap, setRuleMap] = useState<Map<string, boolean>>(new Map())
  const [saving, setSaving] = useState(false)

  const ruleKey = (metalId: string, karat: string | null, dir: "in" | "out") =>
    `${metalId}|${karat ?? ""}|${dir}`

  useEffect(() => {
    if (!open || !sectionId) return
    void (async () => {
      const [sm, mt, kt, rr] = await Promise.all([
        supabase.from("section_metals").select("metal_id").eq("section_id", sectionId),
        supabase.from("metals").select("id,name_ar").eq("enabled", true).order("name_ar"),
        supabase.from("metal_karats").select("metal_id,karat"),
        loadSectionRules(sectionId),
      ])
      const allowedMetals = new Set((sm.data ?? []).map((x) => x.metal_id as string))
      const filteredMetals = ((mt.data ?? []) as Metal[]).filter((m) => allowedMetals.has(m.id))
      setMetals(filteredMetals)
      setKarats(((kt.data ?? []) as Karat[]).filter((k) => allowedMetals.has(k.metal_id)))
      setSettings(rr.settings ?? DEFAULT_SETTINGS(sectionId))
      const map = new Map<string, boolean>()
      for (const r of rr.rules) {
        map.set(ruleKey(r.metal_id, r.karat, r.direction), r.allowed)
      }
      setRuleMap(map)
    })()
  }, [open, sectionId])

  const isAllowed = (metalId: string, karat: string | null, dir: "in" | "out") => {
    const k = ruleKey(metalId, karat, dir)
    if (ruleMap.has(k)) return ruleMap.get(k)!
    return true // default allow
  }

  const setAllowed = (metalId: string, karat: string | null, dir: "in" | "out", val: boolean) => {
    setRuleMap((prev) => {
      const next = new Map(prev)
      next.set(ruleKey(metalId, karat, dir), val)
      return next
    })
  }

  const submit = async () => {
    if (!sectionId || !settings) return
    setSaving(true)
    // Save settings (upsert)
    const { error: sErr } = await supabase.from("section_settings").upsert(
      {
        section_id: sectionId,
        allow_karat_change: settings.allow_karat_change,
        allow_category_change: settings.allow_category_change,
        allow_count_change: settings.allow_count_change,
      },
      { onConflict: "section_id" },
    )
    if (sErr) {
      setSaving(false)
      return toast.error("فشل حفظ الإعدادات: " + sErr.message)
    }

    // Build rules to upsert: only rows present in ruleMap
    const rows: Array<Omit<MetalRule, "section_id"> & { section_id: string }> = []
    for (const [k, allowed] of ruleMap.entries()) {
      const [metalId, karatStr, direction] = k.split("|") as [string, string, "in" | "out"]
      rows.push({
        section_id: sectionId,
        metal_id: metalId,
        karat: karatStr === "" ? null : karatStr,
        direction,
        allowed,
      })
    }
    // Delete existing rules then insert (simpler than upsert with composite null key)
    const { error: dErr } = await supabase
      .from("section_metal_rules")
      .delete()
      .eq("section_id", sectionId)
    if (dErr) {
      setSaving(false)
      return toast.error("فشل حفظ القواعد: " + dErr.message)
    }
    if (rows.length > 0) {
      const { error: iErr } = await supabase.from("section_metal_rules").insert(rows)
      if (iErr) {
        setSaving(false)
        return toast.error("فشل حفظ القواعد: " + iErr.message)
      }
    }
    setSaving(false)
    toast.success("تم حفظ إعدادات القسم")
    onOpenChange(false)
    onSaved?.()
  }

  if (!sectionId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>إعدادات القسم{sectionName ? ` — ${sectionName}` : ""}</DialogTitle>
          <DialogDescription>
            تحكم في المعادن والعيارات المسموح بدخولها وخروجها، وصلاحيات التحويل.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="metals-in" className="flex flex-col gap-3">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="metals-in">دخول المعادن</TabsTrigger>
            <TabsTrigger value="metals-out">خروج المعادن</TabsTrigger>
            <TabsTrigger value="karats">العيارات</TabsTrigger>
            <TabsTrigger value="toggles">صلاحيات التحويل</TabsTrigger>
          </TabsList>

          <TabsContent value="metals-in">
            <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto rounded-md border p-3">
              {metals.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد معادن مرتبطة بالقسم.</p>
              )}
              {metals.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isAllowed(m.id, null, "in")}
                    onCheckedChange={(v) => setAllowed(m.id, null, "in", !!v)}
                  />
                  {m.name_ar}
                </label>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="metals-out">
            <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto rounded-md border p-3">
              {metals.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد معادن مرتبطة بالقسم.</p>
              )}
              {metals.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isAllowed(m.id, null, "out")}
                    onCheckedChange={(v) => setAllowed(m.id, null, "out", !!v)}
                  />
                  {m.name_ar}
                </label>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="karats">
            <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto rounded-md border p-3">
              {metals.map((m) => {
                const ks = karats.filter((k) => k.metal_id === m.id)
                if (ks.length === 0) return null
                return (
                  <div key={m.id} className="flex flex-col gap-2">
                    <div className="text-sm font-semibold">{m.name_ar}</div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {ks.map((k) => (
                        <div
                          key={k.karat}
                          className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-1.5"
                        >
                          <span className="text-sm" dir="ltr">
                            عيار {k.karat}
                          </span>
                          <div className="flex items-center gap-3 text-xs">
                            <label className="flex items-center gap-1.5">
                              <Checkbox
                                checked={isAllowed(m.id, k.karat, "in")}
                                onCheckedChange={(v) =>
                                  setAllowed(m.id, k.karat, "in", !!v)
                                }
                              />
                              دخول
                            </label>
                            <label className="flex items-center gap-1.5">
                              <Checkbox
                                checked={isAllowed(m.id, k.karat, "out")}
                                onCheckedChange={(v) =>
                                  setAllowed(m.id, k.karat, "out", !!v)
                                }
                              />
                              خروج
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {metals.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد معادن مرتبطة بالقسم.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="toggles">
            <div className="flex flex-col gap-3 rounded-md border p-3">
              {settings && (
                <>
                  <ToggleRow
                    label="السماح بتغيير العيار عند الإخراج"
                    description="مثلاً: دخول 995 وخروج 750. يتم الحفاظ على الذهب الصافي ثابتاً."
                    checked={settings.allow_karat_change}
                    onChange={(v) => setSettings({ ...settings, allow_karat_change: v })}
                  />
                  <ToggleRow
                    label="السماح بتغيير التصنيف عند الإخراج"
                    description="مثلاً: دخول سبائك وخروج شجر ذهب."
                    checked={settings.allow_category_change}
                    onChange={(v) => setSettings({ ...settings, allow_category_change: v })}
                  />
                  <ToggleRow
                    label="السماح بتغيير العدد عند الإخراج"
                    description="مثلاً: تقسيم سبيكة واحدة إلى 5 قطع. لا يؤثر على الوزن."
                    checked={settings.allow_count_change}
                    onChange={(v) => setSettings({ ...settings, allow_count_change: v })}
                  />
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export default SectionSettingsDialog
