import { useAuth } from "@/contexts/auth-context"

export function ControlPanelPage() {
  const { displayName } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          مرحباً، <span className="font-semibold text-foreground">{displayName}</span>
        </p>
      </div>
    </div>
  )
}

export default ControlPanelPage
