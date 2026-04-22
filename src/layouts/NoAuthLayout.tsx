import { Outlet, useRouterState } from "@tanstack/react-router"

export function NoAuthLayout() {
  const locationKey = useRouterState({
    select: (s) => s.location.href,
  })

  return (
    <div key={locationKey} className="animate-in fade-in duration-400">
      <Outlet />
    </div>
  )
}
