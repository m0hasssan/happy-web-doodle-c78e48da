import { useSyncExternalStore } from "react"
import {
  getNumberFormatSettings,
  subscribeNumberFormat,
  type NumberFormatSettings,
} from "@/lib/number-format"

export function useNumberFormatSettings(): NumberFormatSettings {
  return useSyncExternalStore(
    subscribeNumberFormat,
    getNumberFormatSettings,
    getNumberFormatSettings,
  )
}