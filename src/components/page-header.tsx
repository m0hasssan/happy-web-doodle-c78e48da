import * as React from "react"
import { Link } from "react-router-dom"
import { ChevronRight, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export type PageHeaderCrumb = {
  label: string
  to?: string
}

export interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
  backTo?: string
  onBack?: () => void
  backLabel?: string
  breadcrumbs?: PageHeaderCrumb[]
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  backTo,
  onBack,
  backLabel = "رجوع",
  breadcrumbs,
}: PageHeaderProps) {
  const showBack = Boolean(backTo || onBack)
  const showCrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0)
  const showTopRow = showBack || showCrumbs

  const backInner = (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ChevronRight className="h-4 w-4" />
      {backLabel}
    </span>
  )

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showTopRow && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {showBack ? (
              backTo ? (
                <Link to={backTo}>{backInner}</Link>
              ) : (
                <button type="button" onClick={onBack} className="bg-transparent p-0">
                  {backInner}
                </button>
              )
            ) : null}
          </div>
          {showCrumbs && (
            <nav aria-label="breadcrumb" className="min-w-0">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {breadcrumbs!.map((c, i) => {
                  const isLast = i === breadcrumbs!.length - 1
                  return (
                    <li key={i} className="inline-flex items-center gap-1">
                      {c.to && !isLast ? (
                        <Link
                          to={c.to}
                          className="transition-colors hover:text-foreground"
                        >
                          {c.label}
                        </Link>
                      ) : (
                        <span
                          className={cn(isLast && "font-medium text-foreground")}
                        >
                          {c.label}
                        </span>
                      )}
                      {!isLast && (
                        <ChevronLeft className="h-3 w-3 opacity-60" />
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-strong">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-1">{actions}</div> : null}
      </div>
    </div>
  )
}

export default PageHeader
