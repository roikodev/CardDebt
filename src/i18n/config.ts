import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import { detectSystemLanguage, isAppLanguage, type AppLanguage } from "@/lib/languages"

import en from "./locales/en"
import ja from "./locales/ja"
import zhTW from "./locales/zh-TW"

const STORAGE_KEY = "carddebt:language"

function readPersistedLanguage(): AppLanguage | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { language?: unknown } }
    const l = parsed.state?.language
    return isAppLanguage(l) ? l : null
  } catch {
    return null
  }
}

function initialLng(): AppLanguage {
  const persisted = readPersistedLanguage()
  if (persisted) return persisted
  return detectSystemLanguage()
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-TW": { translation: zhTW },
    ja: { translation: ja },
  },
  lng: initialLng(),
  fallbackLng: "en",
  supportedLngs: ["en", "zh-TW", "ja"],
  interpolation: { escapeValue: false },
  returnNull: false,
})

export function syncI18nLanguage(language: AppLanguage): void {
  if (i18n.language === language) return
  void i18n.changeLanguage(language)
}

export default i18n
