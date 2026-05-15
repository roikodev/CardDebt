import type { ReactNode } from "react"

import cardDebtLogo from "@/assets/CardDebt.png"
import { Outlet, useLocation } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

export function NoAuthLayout({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const pathname = useLocation({ select: (l) => l.pathname })

  return (
    <main
      className="home-hero relative flex min-h-dvh w-full flex-col overflow-hidden bg-transparent text-foreground pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
    >
      <div className="relative z-10 isolate flex min-h-0 w-full flex-1 flex-col">
        <div className="flex shrink-0 justify-center pb-2 pt-[calc(2rem+env(safe-area-inset-top,0px))] sm:pt-[calc(2.5rem+env(safe-area-inset-top,0px))]">
          <div className="relative">
            <div
              className="absolute -inset-3 rounded-[1.35rem] bg-primary/20 blur-xl dark:bg-primary/25"
              aria-hidden
            />
            <img
              src={cardDebtLogo}
              alt={t("noAuth.logoAlt")}
              width={64}
              height={64}
              decoding="async"
              className="relative size-16 rounded-2xl border border-border/70 bg-card/80 object-cover shadow-lg ring-2 ring-primary/15 dark:ring-primary/25"
            />
          </div>
        </div>
        <div
          key={pathname}
          className="motion-reduce:animate-none flex min-h-0 w-full flex-1 flex-col animate-in fade-in-0 duration-300"
        >
          {children ?? <Outlet />}
        </div>
      </div>
    </main>
  )
}
