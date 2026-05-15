import { useEffect } from "react"

import { syncI18nLanguage } from "@/i18n/config"
import { applyDocumentLanguage } from "@/lib/languages"
import { useLanguageStore } from "@/stores/language"

export function LanguageBootstrap() {
  const language = useLanguageStore((s) => s.language)
  const hasHydrated = useLanguageStore((s) => s.hasHydrated)

  useEffect(() => {
    if (!hasHydrated) return
    applyDocumentLanguage(language)
    syncI18nLanguage(language)
  }, [hasHydrated, language])

  return null
}
