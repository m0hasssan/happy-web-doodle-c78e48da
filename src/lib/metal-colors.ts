export type MetalColorKey =
  | "gold"
  | "rose-gold"
  | "bronze"
  | "silver"
  | "platinum"
  | "copper-light"
  | "copper-dark"
  | "emerald"
  | "ruby"
  | "sapphire"
  | "amethyst"
  | "onyx"

export type MetalColorPreset = {
  key: MetalColorKey
  label: string
  swatch: string
  text: string
  bg: string
  border: string
  ring: string
  chart: string
}

// Tailwind classes are written as literal strings so the JIT can pick them up.
export const METAL_COLOR_PRESETS: MetalColorPreset[] = [
  {
    key: "gold",
    label: "ذهبي",
    swatch: "#D4A017",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    ring: "ring-amber-500/30",
    chart: "oklch(0.74 0.15 80)",
  },
  {
    key: "rose-gold",
    label: "ذهبي وردي",
    swatch: "#E0A0A0",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-500/15",
    border: "border-rose-500/40",
    ring: "ring-rose-500/30",
    chart: "oklch(0.74 0.13 20)",
  },
  {
    key: "bronze",
    label: "برونزي",
    swatch: "#A97142",
    text: "text-yellow-800 dark:text-yellow-400",
    bg: "bg-yellow-700/15",
    border: "border-yellow-700/40",
    ring: "ring-yellow-700/30",
    chart: "oklch(0.6 0.12 70)",
  },
  {
    key: "silver",
    label: "فضي",
    swatch: "#B8C0CC",
    text: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-500/15",
    border: "border-slate-500/40",
    ring: "ring-slate-500/30",
    chart: "oklch(0.7 0.02 270)",
  },
  {
    key: "platinum",
    label: "بلاتيني",
    swatch: "#D6DCE3",
    text: "text-zinc-700 dark:text-zinc-300",
    bg: "bg-zinc-400/15",
    border: "border-zinc-400/40",
    ring: "ring-zinc-400/30",
    chart: "oklch(0.78 0.01 270)",
  },
  {
    key: "copper-light",
    label: "نحاسي فاتح",
    swatch: "#E8956C",
    text: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-500/15",
    border: "border-orange-500/40",
    ring: "ring-orange-500/30",
    chart: "oklch(0.7 0.15 50)",
  },
  {
    key: "copper-dark",
    label: "نحاسي داكن",
    swatch: "#9A4A2E",
    text: "text-red-800 dark:text-red-300",
    bg: "bg-red-700/15",
    border: "border-red-700/40",
    ring: "ring-red-700/30",
    chart: "oklch(0.55 0.16 35)",
  },
  {
    key: "emerald",
    label: "أخضر زمردي",
    swatch: "#10B981",
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    ring: "ring-emerald-500/30",
    chart: "oklch(0.7 0.16 160)",
  },
  {
    key: "ruby",
    label: "أحمر ياقوتي",
    swatch: "#E11D48",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-600/15",
    border: "border-rose-600/40",
    ring: "ring-rose-600/30",
    chart: "oklch(0.6 0.2 15)",
  },
  {
    key: "sapphire",
    label: "أزرق سفير",
    swatch: "#2563EB",
    text: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-600/15",
    border: "border-blue-600/40",
    ring: "ring-blue-600/30",
    chart: "oklch(0.6 0.18 250)",
  },
  {
    key: "amethyst",
    label: "بنفسجي",
    swatch: "#9333EA",
    text: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-600/15",
    border: "border-purple-600/40",
    ring: "ring-purple-600/30",
    chart: "oklch(0.6 0.18 300)",
  },
  {
    key: "onyx",
    label: "أسود فحمي",
    swatch: "#374151",
    text: "text-zinc-800 dark:text-zinc-200",
    bg: "bg-zinc-700/15",
    border: "border-zinc-700/40",
    ring: "ring-zinc-700/30",
    chart: "oklch(0.4 0.02 270)",
  },
]

const PRESET_MAP: Record<string, MetalColorPreset> = Object.fromEntries(
  METAL_COLOR_PRESETS.map((p) => [p.key, p]),
)

// Backwards-compatible legacy code → color key mapping (in case some queries still pass metal.code).
const LEGACY_CODE_TO_COLOR: Record<string, string> = {
  gold: "gold",
  silver: "silver",
  copper: "copper-dark",
}

export function getMetalPreset(colorOrCode: string | null | undefined): MetalColorPreset {
  const key = colorOrCode ?? ""
  return PRESET_MAP[key] ?? PRESET_MAP[LEGACY_CODE_TO_COLOR[key] ?? ""] ?? PRESET_MAP.gold
}

export function metalClasses(colorOrCode: string | null | undefined) {
  const p = getMetalPreset(colorOrCode)
  return { text: p.text, bg: p.bg, border: p.border, ring: p.ring, chart: p.chart }
}
