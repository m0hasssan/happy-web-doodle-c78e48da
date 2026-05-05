import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface KaratPrice {
  sell: number
  buy: number
}

async function scrapeEdahab(): Promise<Record<string, KaratPrice | number>> {
  const response = await fetch("https://edahabapp.com/", {
    headers: { "User-Agent": "Mozilla/5.0" },
  })
  const html = await response.text()
  const goldPrices: Record<string, KaratPrice | number> = {}
  const blocks = html.split(/class="[^"]*\bprice-item\b[^"]*"/i).slice(1)

  for (const raw of blocks) {
    const block = raw.slice(0, 2000)
    const textOnly = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    const numberMatches = [...block.matchAll(/class="[^"]*\bnumber-font\b[^"]*"[^>]*>([^<]+)</g)]
    const numbers = numberMatches
      .map((m) => parseFloat(m[1].replace(/[^\d.]/g, "")))
      .filter((n) => !isNaN(n))

    if (textOnly.includes("عيار")) {
      const karatMatch = textOnly.match(/عيار\s*(\d+)/)
      if (karatMatch && numbers.length >= 2) {
        goldPrices[karatMatch[1]] = { sell: numbers[0], buy: numbers[1] }
      }
    } else if (textOnly.includes("الجنيه الذهب") && numbers.length >= 1) {
      goldPrices["coin"] = numbers[0]
    } else if (textOnly.includes("الأوقية") && numbers.length >= 1) {
      goldPrices["ounce"] = numbers[0]
    }
  }
  return goldPrices
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get("action") // 'refresh' أو null
    const isRefresh = req.method === "POST" || action === "refresh"

    if (isRefresh) {
      // اسحب من eDahab وحدّث الجدول
      const gold = await scrapeEdahab()
      const fetchedAt = new Date().toISOString()
      const rows = Object.entries(gold).map(([karat, value]) => {
        if (typeof value === "object") {
          return { karat, sell: value.sell, buy: value.buy, fetched_at: fetchedAt }
        }
        return { karat, sell: value, buy: null, fetched_at: fetchedAt }
      })
      if (rows.length > 0) {
        const { error } = await supabase
          .from("gold_prices")
          .upsert(rows, { onConflict: "karat" })
        if (error) throw error
      }
    }

    // اقرأ من DB دائماً
    const { data: rows, error } = await supabase
      .from("gold_prices")
      .select("karat, sell, buy, fetched_at")
    if (error) throw error

    const gold: Record<string, KaratPrice | number> = {}
    let latestFetched: string | null = null
    for (const r of rows ?? []) {
      if (r.buy !== null && r.buy !== undefined) {
        gold[r.karat] = { sell: Number(r.sell), buy: Number(r.buy) }
      } else {
        gold[r.karat] = Number(r.sell)
      }
      if (!latestFetched || r.fetched_at > latestFetched) latestFetched = r.fetched_at
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          gold,
          currency: "EGP",
          fetched_at: latestFetched ?? new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
