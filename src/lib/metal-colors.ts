export type MetalCode = "gold" | "silver" | "copper" | string

export function metalClasses(code: MetalCode) {
  switch (code) {
    case "gold":
      return {
        text: "text-metal-gold-strong",
        bg: "bg-metal-gold/15",
        border: "border-metal-gold/40",
        ring: "ring-metal-gold/30",
      }
    case "silver":
      return {
        text: "text-metal-silver-strong",
        bg: "bg-metal-silver/15",
        border: "border-metal-silver/40",
        ring: "ring-metal-silver/30",
      }
    case "copper":
      return {
        text: "text-metal-copper-strong",
        bg: "bg-metal-copper/15",
        border: "border-metal-copper/40",
        ring: "ring-metal-copper/30",
      }
    default:
      return {
        text: "text-foreground",
        bg: "bg-muted/40",
        border: "border-border",
        ring: "ring-border",
      }
  }
}
