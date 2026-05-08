export type DigitSystem = "arabic" | "hindi"

export type NumberFormatSettings = {
  digitSystem: DigitSystem
  useThousandsSeparator: boolean
  decimalPlaces: number
  alwaysShowDecimals: boolean
}

const STORAGE_KEY = "number-format-settings:v1"

const DEFAULT_SETTINGS: NumberFormatSettings = {
  digitSystem: "arabic",
  useThousandsSeparator: true,
  decimalPlaces: 3,
  alwaysShowDecimals: false,
}

function loadInitial(): NumberFormatSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

let current: NumberFormatSettings = loadInitial()
const subscribers = new Set<() => void>()

export function getNumberFormatSettings(): NumberFormatSettings {
  return current
}

export function setNumberFormatSettings(next: Partial<NumberFormatSettings>): void {
  current = { ...current, ...next }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // ignore
  }
  subscribers.forEach((cb) => cb())
}

export function subscribeNumberFormat(cb: () => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

function localeFor(s: NumberFormatSettings): string {
  return s.digitSystem === "hindi" ? "ar-EG-u-nu-arab" : "en-US"
}

export type FormatOptions = {
  decimals?: number
  alwaysShowDecimals?: boolean
  useGrouping?: boolean
}

export function formatNumber(
  value: number | string | null | undefined,
  opts: FormatOptions = {},
): string {
  const n = typeof value === "number" ? value : Number(value ?? 0)
  if (!Number.isFinite(n)) return ""
  const s = current
  const decimals = opts.decimals ?? s.decimalPlaces
  const showAll = opts.alwaysShowDecimals ?? s.alwaysShowDecimals
  const useGrouping = opts.useGrouping ?? s.useThousandsSeparator
  return new Intl.NumberFormat(localeFor(s), {
    useGrouping,
    maximumFractionDigits: decimals,
    minimumFractionDigits: showAll ? decimals : 0,
  }).format(n)
}

/** يُستخدم لعرض الأوزان (افتراضي 3 خانات عشرية، يحترم إعدادات النظام). */
export function formatWeight(value: number | string | null | undefined): string {
  return formatNumber(value)
}

/** يُستخدم لعرض الأعداد الصحيحة (بدون كسور). */
export function formatCount(value: number | string | null | undefined): string {
  return formatNumber(value, { decimals: 0, alwaysShowDecimals: false })
}