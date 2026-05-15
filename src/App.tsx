import { RouterProvider, createRouter } from "@tanstack/react-router"

import { routeTree } from "./routeTree.gen"
import { AuthBootstrap } from "@/components/AuthBootstrap"
import { LanguageBootstrap } from "@/components/LanguageBootstrap"
import { Toaster } from "sonner"

const router = createRouter({
  routeTree,
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
      <LanguageBootstrap />
      <RouterProvider router={router} />
      <Toaster richColors closeButton={false} />
    </>
  )
}

export default App
