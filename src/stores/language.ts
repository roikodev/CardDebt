import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { syncI18nLanguage } from "@/i18n/config"
import {
  applyDocumentLanguage,
  detectSystemLanguage,
  isAppLanguage,
  type AppLanguage,
} from "@/lib/languages"

type LanguageState = {
  hasHydrated: boolean
  language: AppLanguage
  setHasHydrated: (v: boolean) => void
  setLanguage: (language: AppLanguage) => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      language: detectSystemLanguage(),
      setHasHydrated: (v) => set({ hasHydrated: v }),
      setLanguage: (language) => {
        applyDocumentLanguage(language)
        syncI18nLanguage(language)
        set({ language })
      },
    }),
    {
      name: "carddebt:language",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ language: s.language }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return
        if (!isAppLanguage(state.language)) {
          state.language = detectSystemLanguage()
        }
        applyDocumentLanguage(state.language)
        syncI18nLanguage(state.language)
        state.setHasHydrated(true)
      },
    },
  ),
)
