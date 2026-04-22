import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const [bipEvent, setBipEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    document.documentElement.classList.add("dark")
    return () => document.documentElement.classList.remove("dark")
  }, [])

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
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto w-full max-w-xl px-6 py-12">
        <div className="rounded-xl border bg-card p-6 text-left shadow-sm">
          <div className="flex items-center gap-3">
            <img
              src="/android-chrome-512x512.png"
              alt="Card Debt app icon"
              className="h-11 w-11 rounded-xl border bg-muted/20 object-cover"
              width={44}
              height={44}
              loading="eager"
              decoding="async"
            />
            <p className="text-sm font-medium text-muted-foreground">CardDebt</p>
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            This app is available on desktop web, or as a PWA on mobile
          </h1>

          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>
              You’re on a mobile browser. To use CardDebt on mobile, install it as
              a <span className="font-medium text-foreground">PWA</span>. Otherwise,
              open it in a desktop browser.
            </p>

            <div className="rounded-lg bg-muted/40 p-4">
              <p className="font-medium text-foreground">
                Install on iPhone/iPad (Safari)
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Tap the Share button.</li>
                <li>Select “Add to Home Screen”.</li>
                <li>Open CardDebt from the new icon.</li>
              </ol>
            </div>

            <div className="rounded-lg bg-muted/40 p-4">
              <p className="font-medium text-foreground">Install on Android (Chrome)</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Open the browser menu (⋮).</li>
                <li>Tap “Install app” / “Add to Home screen”.</li>
                <li>Launch CardDebt from the installed app icon.</li>
              </ol>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" onClick={handleInstall} disabled={!bipEvent}>
              Install PWA
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              I installed it — refresh
            </Button>
          </div>

          {!bipEvent ? (
            <p className="mt-3 text-xs text-muted-foreground">
              If “Install PWA” is disabled, your browser doesn’t expose an install
              prompt here. Use the steps above.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  )
}

