import { useNavigate } from "react-router-dom"
import { User, LayoutDashboard, Palette, Bell, ChevronLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const TABS = [
  {
    key: "general",
    label: "الإعدادات العامة",
    icon: User,
    description: "الاسم، اسم المستخدم وكلمة المرور",
    to: "/account-settings/general",
  },
  {
    key: "dashboard",
    label: "تخصيص لوحة التحكم",
    icon: LayoutDashboard,
    description: "اختر العناصر التي تظهر في لوحة التحكم",
    to: "/account-settings/dashboard",
  },
  {
    key: "appearance",
    label: "المظهر واللغة",
    icon: Palette,
    description: "الوضع الفاتح/الداكن واللغة",
    to: "/account-settings/appearance",
  },
  {
    key: "notifications",
    label: "الإشعارات",
    icon: Bell,
    description: "تفضيلات التنبيهات والإشعارات",
    to: "/account-settings/notifications",
  },
]

export function AccountSettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إعدادات حسابي"
        description="إدارة بيانات حسابك وتفضيلاتك الشخصية"
      />

      <Card className="p-2">
        <nav className="flex flex-col gap-1">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => navigate(t.to)}
                className={cn(
                  "flex items-center gap-3 rounded-md p-3 text-right transition-colors hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.description}
                  </span>
                </div>
                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )
          })}
        </nav>
      </Card>
    </div>
  )
}

export default AccountSettingsPage
