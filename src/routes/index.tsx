import { createFileRoute } from "@tanstack/react-router"

import { NoAuthLayout } from "@/layouts/NoAuthLayout"
import { Home } from "@/pages/Home"

export const Route = createFileRoute("/")({
  component: () => (
    <NoAuthLayout>
      <Home />
    </NoAuthLayout>
  ),
})

