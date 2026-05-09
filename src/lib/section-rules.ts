import { supabase } from "@/integrations/supabase/client"

export type SectionSettings = {
  section_id: string
  allow_karat_change: boolean
  allow_category_change: boolean
  allow_count_change: boolean
}

export type MetalRule = {
  section_id: string
  metal_id: string
  karat: string | null
  direction: "in" | "out"
  allowed: boolean
}

export const DEFAULT_SETTINGS = (sectionId: string): SectionSettings => ({
  section_id: sectionId,
  allow_karat_change: true,
  allow_category_change: true,
  allow_count_change: true,
})

export async function loadSectionRules(sectionId: string) {
  const [s, r] = await Promise.all([
    supabase.from("section_settings").select("*").eq("section_id", sectionId).maybeSingle(),
    supabase.from("section_metal_rules").select("*").eq("section_id", sectionId),
  ])
  return {
    settings: (s.data as SectionSettings | null) ?? DEFAULT_SETTINGS(sectionId),
    rules: (r.data ?? []) as MetalRule[],
  }
}

/** Is this metal allowed for direction (in/out)? karat=null means metal-level check. */
export function isMetalAllowed(
  rules: MetalRule[],
  metalId: string,
  direction: "in" | "out",
): boolean {
  // Metal-level rule (karat is null) wins as a hard switch when explicitly set to false
  const metalRule = rules.find(
    (r) => r.metal_id === metalId && r.karat === null && r.direction === direction,
  )
  if (metalRule && !metalRule.allowed) return false
  // Karats default to allowed unless an explicit rule disallows them, so the
  // metal is usable as long as the metal-level switch isn't off. Karat-level
  // filtering (isKaratAllowed) takes care of the per-karat restrictions.
  return true
}

export function isKaratAllowed(
  rules: MetalRule[],
  metalId: string,
  karat: string,
  direction: "in" | "out",
): boolean {
  const metalRule = rules.find(
    (r) => r.metal_id === metalId && r.karat === null && r.direction === direction,
  )
  if (metalRule && !metalRule.allowed) return false
  const k = rules.find(
    (r) => r.metal_id === metalId && r.karat === karat && r.direction === direction,
  )
  if (k) return k.allowed
  // No explicit karat rule → default allow
  return true
}
