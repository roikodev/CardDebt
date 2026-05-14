import { createFileRoute } from "@tanstack/react-router"

import { ForgetPassword } from "@/pages/ForgetPassword"

export const Route = createFileRoute("/auth/forget-password")({
  component: ForgetPassword,
})
