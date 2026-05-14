import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type PasswordRecoveryPhase = "idle" | "otp" | "password"

type PasswordRecoveryState = {
  email: string | null
  phase: PasswordRecoveryPhase
  createdAt: number | null
  beginFromEmail: (email: string) => void
  /** After `verifyOtp` with type `recovery` succeeds. */
  goToPasswordStep: () => void
  resetToEmail: () => void
  clear: () => void
}

const TTL_MS = 15 * 60 * 1000

export function isPasswordRecoveryFlowValid(state: {
  email: string | null
  phase: PasswordRecoveryPhase
  createdAt: number | null
}): boolean {
  if (!state.email || !state.createdAt) return false
  if (state.phase === "idle") return false
  if (Date.now() - state.createdAt > TTL_MS) return false
  return true
}

export const usePasswordRecoveryStore = create<PasswordRecoveryState>()(
  persist(
    (set) => ({
      email: null,
      phase: "idle",
      createdAt: null,
      beginFromEmail: (email) =>
        set({
          email,
          phase: "otp",
          createdAt: Date.now(),
        }),
      goToPasswordStep: () =>
        set((s) =>
          s.email
            ? { phase: "password", createdAt: Date.now(), email: s.email }
            : { phase: "idle", createdAt: null, email: null }
        ),
      resetToEmail: () =>
        set({
          phase: "idle",
          email: null,
          createdAt: null,
        }),
      clear: () =>
        set({
          email: null,
          phase: "idle",
          createdAt: null,
        }),
    }),
    {
      name: "carddebt:password-recovery",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        email: s.email,
        phase: s.phase,
        createdAt: s.createdAt,
      }),
    },
  ),
)
