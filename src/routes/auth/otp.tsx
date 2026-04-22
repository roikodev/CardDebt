import { createFileRoute, redirect } from "@tanstack/react-router"

import { Otp } from "@/pages/Otp"
import { isIntentValid, useRegistrationStore } from "@/stores/registration"

export const Route = createFileRoute("/auth/otp")({
  beforeLoad: () => {
    const { intent } = useRegistrationStore.getState()

    if (!isIntentValid(intent)) {
      throw redirect({ to: "/auth/signup" })
    }
  },
  component: Otp,
})

