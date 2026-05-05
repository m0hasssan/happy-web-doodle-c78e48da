import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"

export type ActiveShift = {
  id: string
  code: string
  started_at: string
  started_by_name: string | null
} | null

let listeners: Array<() => void> = []
export function notifyShiftChange() {
  listeners.forEach((fn) => fn())
}

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
    const fn = () => refresh()
    listeners.push(fn)
    return () => {
      listeners = listeners.filter((x) => x !== fn)
    }
  }, [refresh])

  return { shift, loading, refresh }
}
