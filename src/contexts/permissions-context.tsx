import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"

export type AppPermission =
  | "view_dashboard"
  | "export_data"
  | "view_users"
  | "manage_users"
  | "create_users"
export type AppRole = "admin" | "user"

interface PermissionsContextValue {
  roles: AppRole[]
  permissions: AppPermission[]
  loading: boolean
  isAdmin: boolean
  hasPermission: (p: AppPermission) => boolean
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(
  undefined,
)

interface CachedAccess {
  roles: AppRole[]
  permissions: AppPermission[]
}

const cacheKey = (userId: string) => `permissions-cache:${userId}`

function readCache(userId: string): CachedAccess | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(cacheKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as CachedAccess
  } catch {
    return null
  }
}

function writeCache(userId: string, value: CachedAccess) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(value))
  } catch {
    // ignore quota errors
  }
}

function clearCache(userId: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(cacheKey(userId))
  } catch {
    // ignore
  }
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [roles, setRoles] = useState<AppRole[]>([])
  const [permissions, setPermissions] = useState<AppPermission[]>([])
  const [loading, setLoading] = useState(true)
  const lastUserId = useRef<string | null>(null)

  const fetchAccess = useCallback(async (userId: string) => {
    const [rolesRes, permsRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", userId),
    ])
    const nextRoles = (rolesRes.data ?? []).map((r) => r.role as AppRole)
    const nextPerms = (permsRes.data ?? []).map(
      (p) => p.permission as AppPermission,
    )
    setRoles(nextRoles)
    setPermissions(nextPerms)
    writeCache(userId, { roles: nextRoles, permissions: nextPerms })
  }, [])

  const refresh = useCallback(async () => {
    if (!user) return
    await fetchAccess(user.id)
  }, [user, fetchAccess])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setRoles([])
      setPermissions([])
      setLoading(false)
      lastUserId.current = null
      return
    }

    // Same user as before — keep state, no need to reload
    if (lastUserId.current === user.id) return
    lastUserId.current = user.id

    // Hydrate instantly from cache if available
    const cached = readCache(user.id)
    if (cached) {
      setRoles(cached.roles)
      setPermissions(cached.permissions)
      setLoading(false)
      // Revalidate silently in the background
      fetchAccess(user.id).catch(() => {
        // ignore — keep cached values
      })
    } else {
      setLoading(true)
      fetchAccess(user.id)
        .catch(() => {
          setRoles([])
          setPermissions([])
        })
        .finally(() => setLoading(false))
    }
  }, [user, authLoading, fetchAccess])

  // Clear cache on sign-out
  useEffect(() => {
    if (!authLoading && !user && lastUserId.current) {
      clearCache(lastUserId.current)
      lastUserId.current = null
    }
  }, [user, authLoading])

  const isAdmin = roles.includes("admin")
  const hasPermission = (p: AppPermission) =>
    isAdmin || permissions.includes(p)

  return (
    <PermissionsContext.Provider
      value={{ roles, permissions, loading, isAdmin, hasPermission, refresh }}
    >
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissionsContext() {
  const ctx = useContext(PermissionsContext)
  if (!ctx)
    throw new Error(
      "usePermissionsContext must be used within PermissionsProvider",
    )
  return ctx
}
