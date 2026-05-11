import { useEffect, useState } from "react"
import { Loader2, Check, X } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

export function AccountSettingsGeneralPage() {
  const { user, profile, refreshProfile } = useAuth()
  const currentUsername = (user?.email ?? "").replace(/@users\.local$/, "")

  const [fullName, setFullName] = useState(profile?.full_name ?? "")
  const [username, setUsername] = useState(currentUsername)
  const [savingProfile, setSavingProfile] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle")

  useEffect(() => {
    const trimmed = username.trim().toLowerCase()
    if (trimmed === currentUsername) {
      setUsernameStatus("idle")
      return
    }
    if (!/^[a-z0-9_.-]{2,30}$/.test(trimmed)) {
      setUsernameStatus("invalid")
      return
    }
    setUsernameStatus("checking")
    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", `${trimmed}@users.local`)
        .maybeSingle()
      if (error) {
        setUsernameStatus("idle")
        return
      }
      setUsernameStatus(data ? "taken" : "available")
    }, 400)
    return () => clearTimeout(handle)
  }, [username, currentUsername])

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const trimmedName = fullName.trim()
    const trimmedUsername = username.trim().toLowerCase()

    if (!trimmedName) {
      toast.error("الاسم مطلوب")
      return
    }
    if (!/^[a-z0-9_.-]{2,30}$/.test(trimmedUsername)) {
      toast.error("اسم مستخدم غير صالح (حروف إنجليزية وأرقام فقط)")
      return
    }

    setSavingProfile(true)
    try {
      const nameChanged = trimmedName !== (profile?.full_name ?? "")
      const usernameChanged = trimmedUsername !== currentUsername

      if (nameChanged) {
        const { error } = await supabase
          .from("profiles")
          .update({ full_name: trimmedName })
          .eq("id", user.id)
        if (error) throw error
      }

      if (usernameChanged) {
        const newEmail = `${trimmedUsername}@users.local`
        const { error } = await supabase.auth.updateUser({ email: newEmail })
        if (error) {
          throw new Error(
            /already|exists|duplicate/i.test(error.message)
              ? "اسم المستخدم مستخدم بالفعل"
              : error.message,
          )
        }
        await supabase.from("profiles").update({ email: newEmail }).eq("id", user.id)
      }

      await refreshProfile()
      toast.success("تم حفظ التغييرات")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ")
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.email) return
    if (newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين")
      return
    }

    setSavingPassword(true)
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInErr) throw new Error("كلمة المرور الحالية غير صحيحة")

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("تم تغيير كلمة المرور")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء تغيير كلمة المرور")
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الإعدادات العامة"
        description="تعديل الاسم واسم المستخدم وكلمة المرور"
        backTo="/account-settings"
        breadcrumbs={[
          { label: "إعدادات حسابي", to: "/account-settings" },
          { label: "الإعدادات العامة" },
        ]}
      />

      <Card className="p-6">
        <h2 className="text-lg font-semibold">المعلومات الشخصية</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          تعديل اسمك واسم المستخدم الخاص بك
        </p>
        <form onSubmit={handleSaveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="full_name">الاسم الكامل</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="الاسم الكامل"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">اسم المستخدم</Label>
            <div className="relative">
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                dir="rtl"
                placeholder="username"
                className="pl-9 text-right"
              />
              {usernameStatus !== "idle" && (
                <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
                  {usernameStatus === "checking" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : usernameStatus === "available" ? (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500">
                      <Check className="h-2.5 w-2.5 text-background" strokeWidth={4} />
                    </span>
                  ) : (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive">
                      <X className="h-2.5 w-2.5 text-background" strokeWidth={4} />
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              type="submit"
              disabled={
                savingProfile ||
                usernameStatus === "checking" ||
                usernameStatus === "taken" ||
                usernameStatus === "invalid"
              }
            >
              {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ التغييرات
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">تغيير كلمة المرور</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          أدخل كلمة المرور الحالية ثم كلمة المرور الجديدة
        </p>
        <form onSubmit={handleChangePassword} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="current_password">كلمة المرور الحالية</Label>
            <Input
              id="current_password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new_password">كلمة المرور الجديدة</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm_password">تأكيد كلمة المرور الجديدة</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={savingPassword}>
              {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              تغيير كلمة المرور
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default AccountSettingsGeneralPage
