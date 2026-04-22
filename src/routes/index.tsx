import { createFileRoute, redirect } from "@tanstack/react-router"

import { supabase } from "@/lib/supabase"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      throw redirect({ to: "/user/dashboard" })
    }
    throw redirect({ to: "/auth/home" })
  },
})

