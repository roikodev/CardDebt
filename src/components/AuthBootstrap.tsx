import { useEffect } from "react"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"

export function AuthBootstrap() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  useEffect(() => {
    let mounted = true

    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      const session = data.session
      if (!session) {
        clearAuth()
        return
      }

      setAuth({
        user: session.user ? { id: session.user.id, email: session.user.email ?? null } : null,
        session: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at ?? null,
          tokenType: session.token_type ?? null,
        },
      })
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (!session) {
        clearAuth()
        return
      }

      setAuth({
        user: session.user ? { id: session.user.id, email: session.user.email ?? null } : null,
        session: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at ?? null,
          tokenType: session.token_type ?? null,
        },
      })
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [clearAuth, setAuth])

  return null
}

