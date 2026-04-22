import { RouterProvider, createRouter } from "@tanstack/react-router"

import { routeTree } from "./routeTree.gen"
import { AuthBootstrap } from "@/components/AuthBootstrap"

const router = createRouter({
  routeTree,
  basepath: "/CardDebt",
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

function App() {
  return (
    <>
      <AuthBootstrap />
      <RouterProvider router={router} />
    </>
  )
}

export default App
