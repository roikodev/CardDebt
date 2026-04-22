import { createFileRoute } from "@tanstack/react-router"

import { NoAuthLayout } from "@/layouts/NoAuthLayout"

export const Route = createFileRoute("/home")({
  component: NoAuthLayout,
})

