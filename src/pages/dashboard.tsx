import { Hand } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"

export function DashboardHome() {
  const { displayName } = useAuth()

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Hand className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold">
            مرحباً، {displayName}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            قم بتصفح القائمة الجانبية لعرض الأقسام المتاحة لك
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardHome
