import { useEffect, useState } from "react"

import { Outlet } from "@tanstack/react-router"

import { cn } from "@/lib/utils"

const WELCOME_DASHBOARD_ZOOM_KEY = "carddebt:welcome-dashboard-zoom"

export function UserLayout() {
  const [playWelcomeZoom] = useState(() => {
    if (typeof sessionStorage === "undefined") return false
    return sessionStorage.getItem(WELCOME_DASHBOARD_ZOOM_KEY) === "1"
  })

  useEffect(() => {
    if (!playWelcomeZoom) return
    const id = window.setTimeout(() => {
      sessionStorage.removeItem(WELCOME_DASHBOARD_ZOOM_KEY)
    }, 700)
    return () => window.clearTimeout(id)
  }, [playWelcomeZoom])

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        playWelcomeZoom &&
          "animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none",
      )}
    >
      <Outlet />
    </div>
  )
}
