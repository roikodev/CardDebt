import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import cardDebtLogo from "@/assets/CardDebt.png"
import { Trans, useTranslation } from "react-i18next"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const [bipEvent, setBipEvent] = useState<BeforeInstallPromptEvent | null>(null)

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false
    const standaloneMedia = window.matchMedia?.("(display-mode: standalone)").matches
    const iosStandalone = Boolean(
      (navigator as unknown as { standalone?: boolean }).standalone,
    )
    return standaloneMedia || iosStandalone
  }, [])

  const isMobileBrowser = useMemo(() => {
    if (typeof window === "undefined") return false
    const ua = navigator.userAgent ?? ""
    const uaMobile = /Android|iPhone|iPad|iPod|Mobi/i.test(ua)
    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false
    return uaMobile || coarsePointer
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault?.()
      setBipEvent(e as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handler as EventListener)
    return () =>
      window.removeEventListener("beforeinstallprompt", handler as EventListener)
  }, [])

  const shouldGate = isMobileBrowser && !isStandalone

  async function handleInstall() {
    if (!bipEvent) return
    await bipEvent.prompt()
    await bipEvent.userChoice
    setBipEvent(null)
  }

  if (!shouldGate) return <>{children}</>

  return (
    <main className="min-h-svh bg-background text-foreground pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      <div className="mx-auto w-full max-w-xl px-6 pb-[calc(3rem+env(safe-area-inset-bottom,0px))] pt-[calc(3rem+env(safe-area-inset-top,0px))]">
        <div className="rounded-xl border bg-card p-6 text-left shadow-sm">
          <div className="flex items-center gap-3">
            <img
              src={cardDebtLogo}
              alt={t("access.appIconAlt")}
              className="h-11 w-11 rounded-xl border bg-muted/20 object-cover"
              width={44}
              height={44}
              loading="eager"
              decoding="async"
            />
            <p className="text-sm font-medium text-muted-foreground">{t("access.brand")}</p>
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {t("access.title")}
          </h1>

          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>
              <Trans
                i18nKey="access.body1"
                components={{
                  accent: <span className="font-medium text-foreground" />,
                }}
                values={{ pwaWord: t("access.pwaWord") }}
              />
            </p>

            <div className="rounded-lg bg-muted/40 p-4">
              <p className="font-medium text-foreground">
                {t("access.iosTitle")}
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>{t("access.ios1")}</li>
                <li>{t("access.ios2")}</li>
                <li>{t("access.ios3")}</li>
              </ol>
            </div>

            <div className="rounded-lg bg-muted/40 p-4">
              <p className="font-medium text-foreground">{t("access.androidTitle")}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>{t("access.android1")}</li>
                <li>{t("access.android2")}</li>
                <li>{t("access.android3")}</li>
              </ol>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" onClick={handleInstall} disabled={!bipEvent}>
              {t("access.installPwa")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              {t("access.refresh")}
            </Button>
          </div>

          {!bipEvent ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("access.installHint")}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  )
}

