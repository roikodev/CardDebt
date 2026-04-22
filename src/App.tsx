import { useMemo } from "react"

import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"

import { NoAuthLayout } from "@/layouts/NoAuthLayout"
import { Home } from "@/pages/Home"
import { Login } from "@/pages/Login"

function App() {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const homeRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "home",
      component: NoAuthLayout,
    })

    const homeIndexRoute = createRoute({
      getParentRoute: () => homeRoute,
      path: "/",
      component: Home,
    })

    const loginRoute = createRoute({
      getParentRoute: () => homeRoute,
      path: "login",
      component: Login,
    })

    const routeTree = rootRoute.addChildren([homeRoute.addChildren([homeIndexRoute, loginRoute])])

    return createRouter({
      routeTree,
      basepath: "/CardDebt",
    })
  }, [])

  return (
    <RouterProvider router={router} />
  )
}

export default App
