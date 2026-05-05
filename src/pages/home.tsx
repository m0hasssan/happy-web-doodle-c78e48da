import { Button } from "@/components/ui/button"

export function HomePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 text-sm leading-loose">
      <div>
        <h1 className="font-medium">Project ready!</h1>
        <p>You may now add components and start building.</p>
        <p>We&apos;ve already added the button component for you.</p>
        <Button className="mt-2">Button</Button>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        (Press <kbd>d</kbd> to toggle dark mode)
      </div>
    </div>
  )
}

export default HomePage
