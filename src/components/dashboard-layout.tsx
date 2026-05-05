import { Outlet, useNavigate } from "react-router-dom"
import { Bell, Settings, Moon, Sun, LogOut } from "lucide-react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/components/theme-provider"
import { toast } from "sonner"

function getInitials(name: string | undefined) {
  if (!name) return "؟"
  return name.charAt(0).toUpperCase()
}

export function DashboardLayout() {
  const { user, displayName, signOut } = useAuth()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  const toggleTheme = () => setTheme(isDark ? "light" : "dark")

  const handleLogout = async () => {
    await signOut()
    toast.success("تم تسجيل الخروج")
    navigate("/login", { replace: true })
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-between gap-3 border-b bg-background px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="حساب المستخدم"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs font-medium">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 p-2">
                  <div className="flex items-center gap-3 px-2 py-1.5">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="text-sm font-medium">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col text-right">
                      <span className="truncate text-sm font-semibold">
                        {displayName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground" dir="ltr">
                        {user?.email}
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <Settings />
                    <span>إعدادات حسابي</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                    <LogOut />
                    <span>تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" disabled aria-label="الإشعارات">
                <Bell className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="تبديل الوضع"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" disabled aria-label="الإعدادات">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 bg-muted/20 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
