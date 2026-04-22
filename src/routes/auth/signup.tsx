import { createFileRoute } from "@tanstack/react-router"

import { Signup } from "@/pages/Signup"

export const Route = createFileRoute("/auth/signup")({
  component: Signup,
})

