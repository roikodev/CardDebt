import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

type AuthUser = {
  id: string
  email: string | null
}

type AuthSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number | null
  tokenType: string | null
}

type AuthState = {
  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  user: AuthUser | null
  session: AuthSession | null
  setAuth: (next: { user: AuthUser | null; session: AuthSession | null }) => void
  clearAuth: () => void
  isSessionExpired: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      user: null,
      session: null,
      setAuth: (next) => set({ user: next.user, session: next.session }),
      clearAuth: () => set({ user: null, session: null }),
      isSessionExpired: () => {
        const session = get().session
        if (!session) return true
        if (!session.expiresAt) return false
        return Date.now() >= session.expiresAt * 1000
      },
    }),
    {
      name: "carddebt:auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) =>
        ({
          user: s.user,
          session: s.session,
        }) as Partial<AuthState>,
      onRehydrateStorage: () => (state, error) => {
        if (!error) state?.setHasHydrated(true)
      },
    },
  ),
)

