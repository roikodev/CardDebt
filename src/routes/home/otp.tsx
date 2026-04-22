import { createFileRoute, redirect } from "@tanstack/react-router"

import { Otp } from "@/pages/Otp"
import { isIntentValid, useRegistrationStore } from "@/stores/registration"

export const Route = createFileRoute("/home/otp")({
  beforeLoad: () => {
    const { intent } = useRegistrationStore.getState()

    if (!isIntentValid(intent)) {
      throw redirect({ to: "/home/signup" })
    }
  },
  component: Otp,
})

