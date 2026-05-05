import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"

export type ActiveShift = {
  id: string
  code: string
  started_at: string
  started_by_name: string | null
} | null

export function useActiveShift() {
  const [shift, setShift] = useState<ActiveShift>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("shifts")
      .select("id,code,started_at,started_by_name")
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    setShift((data as ActiveShift) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const ch = supabase
      .channel("active-shift")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts" },
        () => refresh(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh])

  return { shift, loading, refresh }
}
