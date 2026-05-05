import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { DirectionProvider } from "@/components/ui/direction"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

// Ensure the document root reflects RTL so all CSS logical properties flip.
if (typeof document !== "undefined") {
  document.documentElement.setAttribute("dir", "rtl")
  document.documentElement.setAttribute("lang", "ar")
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <DirectionProvider dir="rtl">
        <TooltipProvider>
          <App />
          <Toaster />
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  </StrictMode>
)
