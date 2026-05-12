import { useState, type FormEvent } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import logoLight from "@/assets/logos/logo-horizontal-light.svg"
import logoDark from "@/assets/logos/logo-horizontal-dark.svg"

export function LoginPage() {
  const { session, signIn, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!authLoading && session) {
    return <Navigate to="/control-panel" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const uname = username.trim().toLowerCase()
    if (!uname) {
      toast.error("الرجاء إدخال اسم المستخدم")
      return
    }
    setSubmitting(true)
    const { error } = await signIn(`${uname}@users.local`, password)
    setSubmitting(false)
    if (error) {
      toast.error("فشل تسجيل الدخول", { description: "تأكد من اسم المستخدم وكلمة المرور" })
      return
    }
    toast.success("تم تسجيل الدخول بنجاح")
    navigate("/control-panel", { replace: true })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto my-4 flex items-center justify-center">
            <img src={logoLight} alt="GemFlow" className="h-[21px] w-auto dark:hidden" />
            <img src={logoDark} alt="GemFlow" className="hidden h-[21px] w-auto dark:block" />
          </div>
          <CardTitle className="text-2xl">تسجيل الدخول</CardTitle>
          <CardDescription>أدخل بياناتك للدخول إلى لوحة التحكم</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                dir="ltr"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginPage
