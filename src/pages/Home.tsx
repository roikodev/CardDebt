import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"
import { LayoutGrid, PieChart, Wallet } from "lucide-react"

const highlights = [
  { icon: LayoutGrid, label: "Collection" },
  { icon: Wallet, label: "Spend & balance" },
  { icon: PieChart, label: "Insights" },
] as const

export function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
      <div className="relative mx-auto w-full max-w-md text-center">
        <div
          className="pointer-events-none absolute -top-6 left-1/2 h-44 w-[min(100%,20rem)] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl dark:bg-primary/[0.12]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-ring/[0.06] blur-3xl"
          aria-hidden
        />

        <p className="relative text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Card Debt
        </p>
        <h2 className="relative mt-3 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Track cards,{" "}
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            spending
          </span>
          , and value
        </h2>
        <p className="relative mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          Sign in so your hobby stays organized—wherever you open the app.
        </p>

        <div
          className="relative mx-auto mt-6 h-px w-24 max-w-[min(12rem,60%)] bg-gradient-to-r from-transparent via-border to-transparent"
          aria-hidden
        />

        <ul className="relative mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {highlights.map(({ icon: Icon, label }) => (
            <li key={label}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm dark:bg-background/30">
                <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                {label}
              </span>
            </li>
          ))}
        </ul>

        <div className="relative mt-9 flex justify-center">
          <Button asChild size="default" className="min-w-[7.5rem] shadow-md">
            <Link to="/auth/login">Login</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
