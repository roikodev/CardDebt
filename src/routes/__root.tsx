import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router"

export const Route = createRootRoute({
  component: RootTransition,
})

function RootTransition() {
  const { href, pathname } = useRouterState({
    select: (s) => ({ href: s.location.href, pathname: s.location.pathname }),
  })

  if (pathname.startsWith("/auth")) {
    return <Outlet />
  }

  return (
    <div key={href} className="animate-in fade-in duration-300">
      <Outlet />
    </div>
  )
}

