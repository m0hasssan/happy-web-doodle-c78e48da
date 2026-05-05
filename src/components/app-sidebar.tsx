import { Home, LayoutDashboard, ShieldCheck } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { usePermissions, type AppPermission } from "@/hooks/use-permissions"

type Item = {
  title: string
  url: string
  icon: typeof Home
  requires?: AppPermission
  adminOnly?: boolean
}

const items: Item[] = [
  { title: "الرئيسية", url: "/dashboard", icon: Home },
  { title: "لوحة التحكم", url: "/control-panel", icon: LayoutDashboard, requires: "view_dashboard" },
  { title: "المستخدمين والصلاحيات", url: "/users-permissions", icon: ShieldCheck, requires: "view_users" },
]

export function AppSidebar() {
  const location = useLocation()
  const { hasPermission, loading } = usePermissions()

  const visible = items.filter((it) => {
    if (loading) return !it.requires
    if (it.requires && !hasPermission(it.requires)) return false
    return true
  })

  return (
    <Sidebar side="right" collapsible="icon" className="border-s border-border">
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
                      <NavLink to={item.url}>
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
    </Sidebar>
  )
}
