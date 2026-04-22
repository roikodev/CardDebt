import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import cardDebtLogo from "@/assets/CardDebt.png"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

function App() {
  const [bipEvent, setBipEvent] = useState<BeforeInstallPromptEvent | null>(null)

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false

    // Android/Chrome + most modern browsers
    const standaloneMedia = window.matchMedia?.("(display-mode: standalone)")
      .matches

    // iOS Safari (Add to Home Screen)
    const iosStandalone = Boolean((navigator as unknown as { standalone?: boolean }).standalone)

    return standaloneMedia || iosStandalone
  }, [])

  useEffect(() => {
    document.documentElement.classList.add("dark")
    return () => document.documentElement.classList.remove("dark")
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
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener)
  }, [])

  const shouldGate = isMobileBrowser && !isStandalone

  async function handleInstall() {
    if (!bipEvent) return
    await bipEvent.prompt()
    await bipEvent.userChoice
    setBipEvent(null)
  }

  if (shouldGate) {
    return (
      <main className="min-h-svh bg-background text-foreground">
        <div className="mx-auto w-full max-w-xl px-6 py-12">
          <div className="rounded-xl border bg-card p-6 text-left shadow-sm">
            <div className="flex items-center gap-3">
              <img
                src={cardDebtLogo}
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
                You’re on a mobile browser. To use CardDebt on mobile, install it
                as a <span className="font-medium text-foreground">PWA</span>.
                Otherwise, open it in a desktop browser.
              </p>

              <div className="rounded-lg bg-muted/40 p-4">
                <p className="font-medium text-foreground">Install on iPhone/iPad (Safari)</p>
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
              <Button
                type="button"
                onClick={handleInstall}
                disabled={!bipEvent}
              >
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

  return (
    <main className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_-10%,hsl(var(--primary)/0.28),transparent_55%),radial-gradient(900px_circle_at_10%_20%,hsl(var(--ring)/0.16),transparent_45%),radial-gradient(900px_circle_at_90%_20%,hsl(var(--ring)/0.12),transparent_45%)]"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-14">
        <div className="flex w-full flex-col items-center text-center">
          <img
            src={cardDebtLogo}
            alt="Card Debt app icon"
            className="h-16 w-16 rounded-2xl border bg-card/60 object-cover shadow-sm"
            width={64}
            height={64}
            loading="eager"
            decoding="async"
          />
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
            {isStandalone ? "Running as PWA" : "Web"}
          </div>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Welcome to <span className="text-primary">Card Debt</span>
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
            Track your collection and your spending with a simple, focused workflow.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button type="button" size="lg" className="h-10 px-8">
              Login
            </Button>
            <Button type="button" variant="outline" size="lg" className="h-10 px-8">
              Continue as guest
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Mobile users: install as PWA for the best experience.
          </p>
        </div>

        <div className="mt-10 w-full max-w-3xl rounded-xl border bg-card/60 p-5 text-left shadow-sm backdrop-blur">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Next step</p>
            <p className="text-sm text-muted-foreground">
              Tell me what you want after login (Supabase auth, email/password, OAuth, etc.).
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
