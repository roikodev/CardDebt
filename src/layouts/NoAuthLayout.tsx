import type { ReactNode } from "react"

import { Outlet, useRouterState } from "@tanstack/react-router"
import cardDebtLogo from "@/assets/CardDebt.png"

export function NoAuthLayout({ children }: { children?: ReactNode }) {
  const locationKey = useRouterState({
    select: (s) => s.location.href,
  })

  return (
    <div>
      <div className="mx-auto w-full max-w-md px-6 pt-14">
        <div className="flex justify-center">
          <img
            src={cardDebtLogo}
            alt="Card Debt app icon"
            className="h-14 w-14 rounded-2xl border bg-card/60 object-cover shadow-sm"
            width={56}
            height={56}
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
      <div key={locationKey} className="animate-in fade-in duration-400">
        {children ?? <Outlet />}
      </div>
    </div>
  )
}
