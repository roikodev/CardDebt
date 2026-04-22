import { createFileRoute, redirect } from "@tanstack/react-router"
import { UserLayout } from "@/layouts/UserLayout"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"

export const Route = createFileRoute("/user")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      throw redirect({ to: "/auth/login" })
    }

    // Keep Zustand in sync for UI usage (non-blocking beyond getSession()).
    useAuthStore.getState().setAuth({
      user: data.session.user
        ? { id: data.session.user.id, email: data.session.user.email ?? null }
        : null,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null,
        tokenType: data.session.token_type ?? null,
      },
    })
  },
  component: UserLayout,
})

