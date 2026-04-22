import { createFileRoute } from "@tanstack/react-router"

import { Login } from "@/pages/Login"

export const Route = createFileRoute("/home/login")({
  component: Login,
})

