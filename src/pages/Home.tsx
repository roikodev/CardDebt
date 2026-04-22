import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import cardDebtLogo from "@/assets/CardDebt.png"
import { Link } from "@tanstack/react-router"

export function Home() {
  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone)
    )
  }, [])

  return (
    <main className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-10%,hsl(var(--primary)/0.28),transparent_55%),radial-gradient(900px_circle_at_10%_20%,hsl(var(--ring)/0.16),transparent_45%),radial-gradient(900px_circle_at_90%_20%,hsl(var(--ring)/0.12),transparent_45%)]"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-14">
        <div className="flex w-full flex-col items-center text-center">
          <img
            src={cardDebtLogo}
            alt="Card Debt app icon"
            className="h-16 w-16 rounded-2xl border bg-card/60 object-cover shadow-sm"
            width={64}
            height={64}
            loading="eager"
            decoding="async"
          />
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
            {isStandalone ? "Running as PWA" : "Web"}
          </div>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Welcome to <span className="text-primary">Card Debt</span>
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
            Track your collection and your spending with a simple, focused workflow.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-10 px-8">
              <Link to="login">Login</Link>
            </Button>
            <Button type="button" variant="outline" size="lg" className="h-10 px-8">
              Continue as guest
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Mobile users: install as PWA for the best experience.
          </p>
        </div>

        <div className="mt-10 w-full max-w-3xl rounded-xl border bg-card/60 p-5 text-left shadow-sm backdrop-blur">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Next step</p>
            <p className="text-sm text-muted-foreground">
              Tell me what you want after login (Supabase auth, email/password, OAuth, etc.).
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

