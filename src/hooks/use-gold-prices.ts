import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"

export interface GoldKaratPrice {
  sell: number
  buy: number
}

export interface GoldPricesData {
  gold: Record<string, GoldKaratPrice | number>
  currency: string
  fetched_at: string
}

/**
 * يقرأ الأسعار من قاعدة البيانات (محدثة بواسطة cron كل دقيقة من eDahab).
 * - عند التحميل وعند العودة للتبويب يجلب أحدث القيم.
 * - refresh() يجبر إعادة سحب فوري من eDahab.
 */
export function useGoldPrices() {
  const [data, setData] = useState<GoldPricesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFromDb = useCallback(async () => {
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "gold-prices",
        { method: "GET" },
      )
      if (fnError) throw fnError
      if (!result?.success) throw new Error(result?.error || "فشل جلب الأسعار")
      setData(result.data as GoldPricesData)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "gold-prices?action=refresh",
        { method: "GET" },
      )
      if (fnError) throw fnError
      if (!result?.success) throw new Error(result?.error || "فشل التحديث")
      setData(result.data as GoldPricesData)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchFromDb()
    const onFocus = () => fetchFromDb()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [fetchFromDb])

  return { data, loading, refreshing, error, refresh }
}

export function formatTimeAgoAr(iso?: string): string {
  if (!iso) return ""
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 1) return "تم التحديث الآن"
  if (minutes === 1) return "تم التحديث منذ دقيقة"
  if (minutes === 2) return "تم التحديث منذ دقيقتين"
  if (minutes < 11) return `تم التحديث منذ ${minutes} دقائق`
  return `تم التحديث منذ ${minutes} دقيقة`
}
