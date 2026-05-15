export const APP_LANGUAGES = ["en", "zh-TW", "ja"] as const

export type AppLanguage = (typeof APP_LANGUAGES)[number]

export const LANGUAGE_OPTIONS: readonly {
  value: AppLanguage
  label: string
}[] = [
  { value: "en", label: "English" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "ja", label: "日本語" },
]

const TRADITIONAL_CHINESE_PREFIXES = ["zh-tw", "zh-hk", "zh-hant", "zh-mo"]

function normalizeLocaleTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, "-")
}

function localeToAppLanguage(tag: string): AppLanguage | null {
  const normalized = normalizeLocaleTag(tag)
  if (!normalized) return null

  if (normalized.startsWith("ja")) return "ja"

  if (TRADITIONAL_CHINESE_PREFIXES.some((p) => normalized === p || normalized.startsWith(`${p}-`))) {
    return "zh-TW"
  }

  if (normalized.includes("hant")) return "zh-TW"

  if (normalized === "zh" || normalized.startsWith("zh-")) {
    if (
      normalized.includes("hans") ||
      normalized === "zh-cn" ||
      normalized.startsWith("zh-cn") ||
      normalized === "zh-sg" ||
      normalized.startsWith("zh-sg")
    ) {
      return null
    }
    return "zh-TW"
  }

  if (normalized.startsWith("en")) return "en"

  return null
}

/** Best-effort match from `navigator.language` / `navigator.languages`. */
export function detectSystemLanguage(): AppLanguage {
  if (typeof navigator === "undefined") return "en"

  const tags = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean)

  for (const tag of tags) {
    const match = localeToAppLanguage(tag)
    if (match) return match
  }

  return "en"
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && (APP_LANGUAGES as readonly string[]).includes(value)
}

export function languageOptionLabel(value: AppLanguage): string {
  return LANGUAGE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export function applyDocumentLanguage(language: AppLanguage): void {
  if (typeof document === "undefined") return
  document.documentElement.lang = language
}
