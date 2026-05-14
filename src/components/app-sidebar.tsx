import { LayoutDashboard, ShieldCheck, Vault, Settings, ArrowLeftRight, Truck, Factory, Clock, ClipboardList, Recycle } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { usePermissions, type AppPermission } from "@/hooks/use-permissions"
import logoHorizontalLight from "@/assets/logos/logo-horizontal-light.svg"
import logoHorizontalDark from "@/assets/logos/logo-horizontal-dark.svg"
import logoMark from "@/assets/logos/logo-mark.svg"

type Item = {
  title: string
  url: string
  icon: typeof LayoutDashboard
  requires?: AppPermission
  adminOnly?: boolean
}

const items: Item[] = [
  { title: "لوحة التحكم", url: "/control-panel", icon: LayoutDashboard },
  { title: "الخزن", url: "/vaults", icon: Vault, requires: "view_vaults" },
  { title: "أقسام التصنيع", url: "/sections", icon: Factory, requires: "view_sections" },
  { title: "أوامر الشغل", url: "/work-orders", icon: ClipboardList, requires: "view_work_orders" },
  { title: "قيود الحركة", url: "/movements", icon: ArrowLeftRight, requires: "view_movements" },
  { title: "الموردين", url: "/suppliers", icon: Truck, requires: "view_suppliers" },
  { title: "الشيفتات", url: "/shifts", icon: Clock, requires: "view_shifts_history" },
  { title: "الخسيات والاسترداد", url: "/recovery", icon: Recycle, requires: "view_recovery" },
  { title: "المستخدمين والصلاحيات", url: "/users-permissions", icon: ShieldCheck, requires: "view_users" },
  { title: "إعدادات النظام", url: "/system-settings", icon: Settings, requires: "view_system_settings" },
]

export function AppSidebar() {
  const location = useLocation()
  const { hasPermission, loading } = usePermissions()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const collapsed = state === "collapsed"

  const visible = items.filter((it) => {
    if (loading) return !it.requires
    if (it.requires && !hasPermission(it.requires)) return false
    return true
  })

  return (
    <Sidebar side="right" collapsible="icon" className="border-s-0 border-e border-border">
      <SidebarHeader>
        <div className="flex items-center justify-center px-2 py-3">
          {collapsed ? (
            <img src={logoMark} alt="الشعار" className="h-[22px] w-[22px]" />
          ) : (
            <>
              <img
                src={logoHorizontalLight}
                alt="الشعار"
                className="h-[26px] w-auto max-w-full block dark:hidden"
              />
              <img
                src={logoHorizontalDark}
                alt="الشعار"
                className="h-[26px] w-auto max-w-full hidden dark:block"
              />
            </>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>القائمة</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0">
              {visible.map((item) => {
                const isActive = location.pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className="h-10 p-3 data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground"
                    >
                      <NavLink
                        to={item.url}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false)
                        }}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-2 pt-1 text-center text-[10px] text-muted-foreground">
          {collapsed ? "v1.0" : "الإصدار v1.0"}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
