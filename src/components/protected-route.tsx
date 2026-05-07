import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/auth-context"
import { usePermissions, type AppPermission } from "@/hooks/use-permissions"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent } from "@/components/ui/card"
import { Lock } from "lucide-react"

export function ProtectedRoute({
  children,
  requires,
}: {
  children: React.ReactNode
  requires?: AppPermission
}) {
  const { session, loading } = useAuth()
  const { hasPermission, loading: permLoading } = usePermissions()
  const location = useLocation()

  if (loading || (requires && permLoading)) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (requires && !hasPermission(requires)) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">لا تملك الصلاحية</h2>
            <p className="text-sm text-muted-foreground">ليس لديك صلاحية الوصول لهذه الصفحة.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
