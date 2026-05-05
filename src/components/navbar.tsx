import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"

export function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "text-sm transition-colors hover:text-foreground",
      isActive ? "text-foreground font-medium" : "text-muted-foreground",
    )

  return (
    <header className="border-b">
      <nav className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-6">
        <span className="font-semibold">My App</span>
        <div className="flex items-center gap-4">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/about" className={linkClass}>
            About
          </NavLink>
          <NavLink to="/theme" className={linkClass}>
            Theme
          </NavLink>
        </div>
      </nav>
    </header>
  )
}
