import type { ReactNode } from "react"

import cardDebtLogo from "@/assets/CardDebt.png"
import { Outlet, useRouterState } from "@tanstack/react-router"

export function NoAuthLayout({ children }: { children?: ReactNode }) {
  const locationKey = useRouterState({
    select: (s) => s.location.href,
  })

  return (
    <main className="home-hero relative flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <div className="home-hero-bg" aria-hidden="true">
        <div className="home-hero-bg__grid" />
        <div className="home-hero-bg__orb home-hero-bg__orb--a" />
        <div className="home-hero-bg__orb home-hero-bg__orb--b" />
        <div className="home-hero-bg__orb home-hero-bg__orb--c" />
        <div className="home-hero-bg__shimmer">
          <div className="home-hero-bg__shimmer-inner" />
        </div>
        <div className="home-hero-bg__vignette" />
      </div>

      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col">
        <div className="flex shrink-0 justify-center px-4 pb-2 pt-8 sm:pt-10">
          <div className="relative">
            <div
              className="absolute -inset-3 rounded-[1.35rem] bg-primary/20 blur-2xl dark:bg-primary/25"
              aria-hidden
            />
            <img
              src={cardDebtLogo}
              alt="Card Debt"
              width={64}
              height={64}
              decoding="async"
              className="relative size-16 rounded-2xl border border-border/70 bg-card/80 object-cover shadow-lg ring-2 ring-primary/15 dark:ring-primary/25"
            />
          </div>
        </div>
        <div
          key={locationKey}
          className="motion-reduce:animate-none flex min-h-0 w-full flex-1 flex-col animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both"
        >
          {children ?? <Outlet />}
        </div>
      </div>
    </main>
  )
}
