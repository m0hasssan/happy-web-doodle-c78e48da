import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"

export function AccountSettingsPlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description}
        backTo="/account-settings"
        breadcrumbs={[
          { label: "إعدادات حسابي", to: "/account-settings" },
          { label: title },
        ]}
      />
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">سيتم تفعيل هذا القسم قريباً.</p>
      </Card>
    </div>
  )
}

export function AccountSettingsDashboardPage() {
  return (
    <AccountSettingsPlaceholder
      title="تخصيص لوحة التحكم"
      description="اختر العناصر التي تظهر في لوحة التحكم"
    />
  )
}

export function AccountSettingsAppearancePage() {
  return (
    <AccountSettingsPlaceholder
      title="المظهر واللغة"
      description="الوضع الفاتح/الداكن واللغة"
    />
  )
}

export function AccountSettingsNotificationsPage() {
  return (
    <AccountSettingsPlaceholder
      title="الإشعارات"
      description="تفضيلات التنبيهات والإشعارات"
    />
  )
}
