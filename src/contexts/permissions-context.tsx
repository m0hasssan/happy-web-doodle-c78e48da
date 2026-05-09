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
  // legacy
  | "view_dashboard"
  | "export_data"
  | "manage_users"
  // dashboard
  | "view_control_panel"
  | "view_current_shift"
  | "start_shift"
  | "end_shift"
  | "view_stats"
  | "export_stats"
  // vaults
  | "view_vaults"
  | "create_vault"
  | "view_vault"
  | "access_vault"
  | "edit_vault"
  | "delete_vault"
  | "create_vault_entry"
  | "view_vault_data"
  | "view_vault_movements"
  // sections
  | "view_sections"
  | "create_section"
  | "view_section"
  | "access_section"
  | "edit_section"
  | "delete_section"
  | "view_section_data"
  | "view_section_movements"
  // movements
  | "view_movements"
  | "edit_movement"
  | "delete_movement"
  // suppliers
  | "view_suppliers"
  | "edit_supplier"
  | "delete_supplier"
  | "view_supplier_account"
  // shifts history
  | "view_shifts_history"
  | "view_shift_details"
  // users
  | "view_users"
  | "create_users"
  | "edit_user_profile"
  | "edit_user_permissions"
  | "delete_users"
  // work orders
  | "view_work_orders"
  | "transfer_work_order"
  | "settle_work_order"
  | "delete_work_order"
  // suppliers extended
  | "create_supplier"
  // system settings
  | "view_system_settings"
  | "manage_metals"
  | "manage_categories"
  | "manage_number_format"
  | "export_system_data"
  | "import_system_data"
  | "reset_system_movements"
  | "delete_system_data"
export type AppRole = "admin" | "user"

export type PermissionEntry = {
  permission: AppPermission
  resource_id: string | null
}

interface PermissionsContextValue {
  roles: AppRole[]
  permissions: PermissionEntry[]
  loading: boolean
  isAdmin: boolean
  hasPermission: (p: AppPermission, resourceId?: string | null) => boolean
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(
  undefined,
)

interface CachedAccess {
  roles: AppRole[]
  permissions: PermissionEntry[]
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
  const [permissions, setPermissions] = useState<PermissionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const lastUserId = useRef<string | null>(null)

  const fetchAccess = useCallback(async (userId: string) => {
    const [rolesRes, permsRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("user_permissions")
        .select("permission, resource_id")
        .eq("user_id", userId),
    ])
    const nextRoles = (rolesRes.data ?? []).map((r) => r.role as AppRole)
    const nextPerms: PermissionEntry[] = (permsRes.data ?? []).map((p) => ({
      permission: p.permission as AppPermission,
      resource_id: (p as { resource_id: string | null }).resource_id ?? null,
    }))
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

    if (lastUserId.current === user.id) return
    lastUserId.current = user.id

    const cached = readCache(user.id)
    if (cached) {
      setRoles(cached.roles)
      setPermissions(cached.permissions)
      setLoading(false)
      fetchAccess(user.id).catch(() => {})
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

  useEffect(() => {
    if (!authLoading && !user && lastUserId.current) {
      clearCache(lastUserId.current)
      lastUserId.current = null
    }
  }, [user, authLoading])

  const isAdmin = roles.includes("admin")
  const hasPermission = (p: AppPermission, resourceId?: string | null) => {
    if (isAdmin) return true
    // لوحة التحكم متاحة دائماً لجميع المستخدمين
    if (p === "view_control_panel" && resourceId === undefined) return true
    return permissions.some(
      (e) =>
        e.permission === p &&
        (resourceId === undefined
          ? e.resource_id === null
          : e.resource_id === (resourceId ?? null)),
    )
  }

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
