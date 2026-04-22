import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

type RegistrationIntent = {
  email: string
  nonce: string
  createdAt: number
}

type RegistrationState = {
  intent: RegistrationIntent | null
  startIntent: (email: string) => RegistrationIntent
  clearIntent: () => void
}

const INTENT_TTL_MS = 10 * 60 * 1000

function randomNonce() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

export function isIntentValid(intent: RegistrationIntent | null, email?: string) {
  if (!intent) return false
  if (email && intent.email !== email) return false
  if (Date.now() - intent.createdAt > INTENT_TTL_MS) return false
  return true
}

export const useRegistrationStore = create<RegistrationState>()(
  persist(
    (set) => ({
      intent: null,
      startIntent: (email) => {
        const intent = { email, nonce: randomNonce(), createdAt: Date.now() }
        set({ intent })
        return intent
      },
      clearIntent: () => set({ intent: null }),
    }),
    {
      name: "carddebt:registration-intent",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ intent: s.intent } as Partial<RegistrationState>),
    },
  ),
)

