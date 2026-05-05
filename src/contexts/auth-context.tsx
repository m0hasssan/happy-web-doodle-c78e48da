import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"

interface Profile {
  id: string
  email: string
  full_name: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  displayName: string
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", userId)
      .maybeSingle()
    setProfile(data ?? null)
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        // Defer profile fetch to avoid deadlock with auth listener
        setTimeout(() => loadProfile(newSession.user.id), 0)
      } else {
        setProfile(null)
      }
    })

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing)
      if (existing?.user) loadProfile(existing.user.id)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id)
  }

  const user = session?.user ?? null
  const displayName =
    profile?.full_name?.trim() ||
    (user?.email ? user.email.split("@")[0] : "مستخدم")

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        displayName,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
