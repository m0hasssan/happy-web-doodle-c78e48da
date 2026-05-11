import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { User, LayoutDashboard, Palette, Bell, ArrowRight, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

type TabKey = "general" | "dashboard" | "appearance" | "notifications"

const TABS: { key: TabKey; label: string; icon: typeof User; description: string }[] = [
  { key: "general", label: "الإعدادات العامة", icon: User, description: "الاسم، اسم المستخدم وكلمة المرور" },
  { key: "dashboard", label: "تخصيص لوحة التحكم", icon: LayoutDashboard, description: "اختر العناصر التي تظهر في لوحة التحكم" },
  { key: "appearance", label: "المظهر واللغة", icon: Palette, description: "الوضع الفاتح/الداكن واللغة" },
  { key: "notifications", label: "الإشعارات", icon: Bell, description: "تفضيلات التنبيهات والإشعارات" },
]

export function AccountSettingsPage() {
  const navigate = useNavigate()
  const [active, setActive] = useState<TabKey>("general")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إعدادات حسابي"
        description="إدارة بيانات حسابك وتفضيلاتك الشخصية"
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit p-2">
          <nav className="flex flex-col gap-1">
            {TABS.map((t) => {
              const Icon = t.icon
              const isActive = active === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setActive(t.key)}
                  className={cn(
                    "flex items-start gap-3 rounded-md p-3 text-right transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{t.label}</span>
                    <span
                      className={cn(
                        "text-xs",
                        isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {t.description}
                    </span>
                  </div>
                </button>
              )
            })}
          </nav>
        </Card>

        <div className="min-w-0">
          {active === "general" && <GeneralSettings />}
          {active === "dashboard" && <ComingSoon title="تخصيص لوحة التحكم" />}
          {active === "appearance" && <ComingSoon title="المظهر واللغة" />}
          {active === "notifications" && <ComingSoon title="الإشعارات" />}
        </div>
      </div>
    </div>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        سيتم تفعيل هذا القسم قريباً.
      </p>
    </Card>
  )
}

function GeneralSettings() {
  const { user, profile, refreshProfile } = useAuth()
  const currentUsername = (user?.email ?? "").replace(/@users\.local$/, "")

  const [fullName, setFullName] = useState(profile?.full_name ?? "")
  const [username, setUsername] = useState(currentUsername)
  const [savingProfile, setSavingProfile] = useState(false)

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
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              dir="ltr"
              placeholder="username"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={savingProfile}>
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

export default AccountSettingsPage