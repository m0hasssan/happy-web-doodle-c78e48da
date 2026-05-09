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
import { Input } from "@/components/ui/input"
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
  // Section data tab
  const [name, setName] = useState("")
  const [originalName, setOriginalName] = useState("")
  // Allowed metals (synced with section_metals) — controlled by "metals-in" tab
  const [allowedMetals, setAllowedMetals] = useState<Set<string>>(new Set())
  const [originalAllowedMetals, setOriginalAllowedMetals] = useState<Set<string>>(new Set())

  const ruleKey = (metalId: string, karat: string | null, dir: "in" | "out") =>
    `${metalId}|${karat ?? ""}|${dir}`

  useEffect(() => {
    if (!open || !sectionId) return
    void (async () => {
      const [sm, mt, kt, rr, sec] = await Promise.all([
        supabase.from("section_metals").select("metal_id").eq("section_id", sectionId),
        supabase.from("metals").select("id,name_ar").eq("enabled", true).order("name_ar"),
        supabase.from("metal_karats").select("metal_id,karat"),
        loadSectionRules(sectionId),
        supabase.from("manufacturing_sections").select("name").eq("id", sectionId).single(),
      ])
      const initialAllowed = new Set((sm.data ?? []).map((x) => x.metal_id as string))
      setAllowedMetals(new Set(initialAllowed))
      setOriginalAllowedMetals(initialAllowed)
      setMetals((mt.data ?? []) as Metal[])
      setKarats((kt.data ?? []) as Karat[])
      setSettings(rr.settings ?? DEFAULT_SETTINGS(sectionId))
      setName(sec.data?.name ?? "")
      setOriginalName(sec.data?.name ?? "")
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
    if (!name.trim()) return toast.error("ادخل اسم القسم")
    setSaving(true)

    // 1) Update section name if changed
    if (name.trim() !== originalName) {
      const { error: nErr } = await supabase
        .from("manufacturing_sections")
        .update({ name: name.trim() })
        .eq("id", sectionId)
      if (nErr) {
        setSaving(false)
        return toast.error("فشل تعديل اسم القسم")
      }
    }

    // 2) Sync section_metals (allowed metals)
    const toAdd = [...allowedMetals].filter((id) => !originalAllowedMetals.has(id))
    const toRemove = [...originalAllowedMetals].filter((id) => !allowedMetals.has(id))
    if (toRemove.length > 0) {
      // Block removal if metal has weight
      const { data: invRows } = await supabase
        .from("section_inventory")
        .select("metal_id,total_weight")
        .eq("section_id", sectionId)
        .in("metal_id", toRemove)
      const blocked = (invRows ?? []).find((r) => Number(r.total_weight) > 0)
      if (blocked) {
        const m = metals.find((x) => x.id === blocked.metal_id)
        setSaving(false)
        return toast.error(`لا يمكن إزالة ${m?.name_ar ?? "المعدن"} لأنه يحتوي على وزن`)
      }
      const { error: rmErr } = await supabase
        .from("section_metals")
        .delete()
        .eq("section_id", sectionId)
        .in("metal_id", toRemove)
      if (rmErr) {
        setSaving(false)
        return toast.error("فشل إزالة بعض المعادن")
      }
    }
    if (toAdd.length > 0) {
      const links = toAdd.map((metal_id) => ({ section_id: sectionId, metal_id }))
      const { error: addErr } = await supabase.from("section_metals").insert(links)
      if (addErr) {
        setSaving(false)
        return toast.error("فشل إضافة بعض المعادن")
      }
    }

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

    // Build rules to upsert: only rows present in ruleMap, scoped to currently allowed metals
    const rows: Array<Omit<MetalRule, "section_id"> & { section_id: string }> = []
    for (const [k, allowed] of ruleMap.entries()) {
      const [metalId, karatStr, direction] = k.split("|") as [string, string, "in" | "out"]
      // "in" rules only apply to metals enabled for the section; "out" rules are independent
      if (direction === "in" && !allowedMetals.has(metalId)) continue
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

        <Tabs defaultValue="info" className="flex flex-col gap-3">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="info">بيانات القسم</TabsTrigger>
            <TabsTrigger value="metals-in">دخول المعادن</TabsTrigger>
            <TabsTrigger value="metals-out">خروج المعادن</TabsTrigger>
            <TabsTrigger value="toggles">صلاحيات التحويل</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <div className="flex flex-col gap-3 rounded-md border p-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="section-name-edit">اسم القسم</Label>
                <Input
                  id="section-name-edit"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم القسم"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="metals-in">
            <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                فعّل المعدن للسماح بدخوله إلى القسم، ثم اختر العيارات المسموح بدخولها.
              </p>
              {metals.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد معادن مفعّلة في النظام.</p>
              )}
              {metals.map((m) => {
                const ks = karats.filter((k) => k.metal_id === m.id)
                const enabled = allowedMetals.has(m.id)
                return (
                  <div key={m.id} className="rounded-md border bg-muted/20 p-2">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <Checkbox
                        checked={enabled}
                        onCheckedChange={(v) => {
                          setAllowedMetals((prev) => {
                            const next = new Set(prev)
                            if (v) next.add(m.id)
                            else next.delete(m.id)
                            return next
                          })
                          setAllowed(m.id, null, "in", !!v)
                        }}
                      />
                      {m.name_ar}
                    </label>
                    {enabled && ks.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5 ps-6 sm:grid-cols-3">
                        {ks.map((k) => (
                          <label
                            key={k.karat}
                            className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                          >
                            <Checkbox
                              checked={isAllowed(m.id, k.karat, "in")}
                              onCheckedChange={(v) => setAllowed(m.id, k.karat, "in", !!v)}
                            />
                            <span dir="ltr">عيار {k.karat}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="metals-out">
            <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                فعّل المعدن للسماح بخروجه من القسم، ثم اختر العيارات المسموح بخروجها.
              </p>
              {metals.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد معادن مفعّلة في النظام.</p>
              )}
              {metals.map((m) => {
                const ks = karats.filter((k) => k.metal_id === m.id)
                const enabled = isAllowed(m.id, null, "out")
                return (
                  <div key={m.id} className="rounded-md border bg-muted/20 p-2">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <Checkbox
                        checked={enabled}
                        onCheckedChange={(v) => setAllowed(m.id, null, "out", !!v)}
                      />
                      {m.name_ar}
                    </label>
                    {enabled && ks.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5 ps-6 sm:grid-cols-3">
                        {ks.map((k) => (
                          <label
                            key={k.karat}
                            className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                          >
                            <Checkbox
                              checked={isAllowed(m.id, k.karat, "out")}
                              onCheckedChange={(v) => setAllowed(m.id, k.karat, "out", !!v)}
                            />
                            <span dir="ltr">عيار {k.karat}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
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
