import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Camera, Image as ImageIcon } from "lucide-react"

async function dataUrlToJpegDataUrl(
  dataUrl: string,
  maxDim: number,
  quality: number
): Promise<string> {
  const img = new Image()
  img.decoding = "async"
  img.loading = "eager"
  img.src = dataUrl
  await img.decode()
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height || 1))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext("2d")
  if (!g) throw new Error("No 2d context")
  g.drawImage(img, 0, 0, w, h)
  const jpeg = canvas.toDataURL("image/jpeg", quality)
  if (!jpeg.startsWith("data:image/jpeg")) throw new Error("JPEG encode failed")
  return jpeg
}

function dataUrlToRawBase64(dataUrl: string): string | null {
  const comma = dataUrl.indexOf(",")
  if (comma !== -1 && /;base64$/i.test(dataUrl.slice(0, comma))) {
    return dataUrl.slice(comma + 1)
  }
  const trimmed = dataUrl.trim()
  if (trimmed.length >= 100 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    return trimmed.replace(/\s/g, "")
  }
  return null
}

function formatSupabaseFunctionError(error: unknown): string {
  const anyErr = error as {
    message?: string
    name?: string
    context?: { status?: number; statusText?: string; body?: unknown }
  }
  const status = anyErr?.context?.status
  const statusText = anyErr?.context?.statusText
  const body = anyErr?.context?.body
  return [
    status ? `HTTP ${status}${statusText ? ` ${statusText}` : ""}` : null,
    anyErr?.name ? `${anyErr.name}` : null,
    anyErr?.message ? `${anyErr.message}` : String(error),
    body
      ? `Response body: ${typeof body === "string" ? body : JSON.stringify(body)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n")
}

function logAskAiDevDetail(context: string, detail: unknown) {
  if (import.meta.env.DEV) {
    const extra =
      detail && typeof detail === "object" && "message" in detail
        ? String((detail as { message?: unknown }).message)
        : typeof detail === "string"
          ? detail
          : formatSupabaseFunctionError(detail)
    // eslint-disable-next-line no-console
    console.error(`[Ask AI] ${context}`, extra)
  }
}

const LOADING_MESSAGES = [
  "Sharpening card edges in the image…",
  "Matching print patterns to known sets…",
  "Scanning recent marketplace listings…",
  "Estimating condition from surface glare…",
  "Cross-checking rarity signals…",
  "Building a fair price band from comps…",
  "Almost there — packaging the answer…",
]

function pickLoadingMessage(exclude?: string): string {
  const pool =
    LOADING_MESSAGES.length > 1
      ? LOADING_MESSAGES.filter((m) => m !== exclude)
      : LOADING_MESSAGES
  return pool[Math.floor(Math.random() * pool.length)] ?? "Working…"
}

const LOADING_PROGRESS_CAP = 88

function progressFromElapsedSeconds(elapsedSec: number): number {
  const tau = 36
  const span = LOADING_PROGRESS_CAP - 2
  return 2 + span * (1 - Math.exp(-elapsedSec / tau))
}

const RING_R = 52
const RING_C = 2 * Math.PI * RING_R

type Stage = "pick" | "camera" | "loading" | "done"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AskAiCircularProgress({
  progress,
  labelId,
  className,
}: {
  progress: number
  labelId: string
  className?: string
}) {
  const uid = useId().replace(/:/g, "")
  const gradId = `askAiRingGrad-${uid}`
  const glowId = `askAiRingGlow-${uid}`
  const p = Math.max(0, Math.min(100, progress))
  const dashOffset = RING_C * (1 - p / 100)

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
      aria-labelledby={labelId}
    >
      <div
        className="pointer-events-none absolute inset-[-18%] rounded-full bg-gradient-to-tr from-violet-500/25 via-fuchsia-500/20 to-cyan-400/25 blur-2xl motion-reduce:opacity-40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[-8%] rounded-full border border-dashed border-foreground/10 motion-safe:animate-[spin_32s_linear_infinite]"
        aria-hidden
      />
      <svg
        className="relative size-[min(13.5rem,72vw)] drop-shadow-[0_0_20px_rgba(139,92,246,0.25)]"
        viewBox="0 0 120 120"
        aria-hidden
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgb(139, 92, 246)" />
            <stop offset="45%" stopColor="rgb(217, 70, 239)" />
            <stop offset="100%" stopColor="rgb(34, 211, 238)" />
          </linearGradient>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={RING_R}
          fill="none"
          className="stroke-muted/35"
          strokeWidth="9"
        />
        <circle
          cx="60"
          cy="60"
          r={RING_R}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 60 60)"
          filter={`url(#${glowId})`}
          className="motion-reduce:transition-none motion-safe:transition-[stroke-dashoffset] motion-safe:duration-[1.55s] motion-safe:ease-out"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="font-heading text-[2.1rem] leading-none font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">
          {Math.round(p)}
          <span className="text-lg font-medium text-muted-foreground sm:text-xl">
            %
          </span>
        </span>
      </div>
    </div>
  )
}

export function AskAiResearchDialog({ open, onOpenChange }: Props) {
  const loadingTitleId = useId()
  const [stage, setStage] = useState<Stage>("pick")
  const [showCameraOption, setShowCameraOption] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(() => pickLoadingMessage())
  const [fakeProgress, setFakeProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const albumInputRef = useRef<HTMLInputElement | null>(null)
  const albumPickerGuardRef = useRef(false)
  const albumPickerReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const msgTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const researchLoadingStartedAtRef = useRef(0)

  const loadingOverlayOpen = open && stage === "loading"
  const showChooser = open && (stage === "pick" || stage === "camera")
  const showResult = open && stage === "done"

  const stopLoadingMotion = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (msgTimeoutRef.current) {
      clearTimeout(msgTimeoutRef.current)
      msgTimeoutRef.current = null
    }
  }, [])

  const stopCamera = useCallback(() => {
    const s = streamRef.current
    if (s) {
      for (const t of s.getTracks()) t.stop()
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const releaseAlbumPickerGuard = useCallback(() => {
    albumPickerGuardRef.current = false
    if (albumPickerReleaseTimerRef.current) {
      clearTimeout(albumPickerReleaseTimerRef.current)
      albumPickerReleaseTimerRef.current = null
    }
  }, [])

  const resetAll = useCallback(() => {
    releaseAlbumPickerGuard()
    stopCamera()
    setStage("pick")
    setError(null)
    setAnswer(null)
    setPreviewUrl(null)
    setFakeProgress(0)
    setLoadingMsg(pickLoadingMessage())
    if (albumInputRef.current) albumInputRef.current.value = ""
    stopLoadingMotion()
  }, [releaseAlbumPickerGuard, stopCamera, stopLoadingMotion])

  useEffect(() => {
    if (!open) {
      resetAll()
      return
    }
    function syncCameraOption() {
      const wideFineDesktop =
        window.matchMedia("(min-width: 1024px)").matches &&
        window.matchMedia("(pointer: fine)").matches
      setShowCameraOption(
        !wideFineDesktop && Boolean(navigator.mediaDevices?.getUserMedia)
      )
    }
    syncCameraOption()
    const mq1 = window.matchMedia("(min-width: 1024px)")
    const mq2 = window.matchMedia("(pointer: fine)")
    mq1.addEventListener("change", syncCameraOption)
    mq2.addEventListener("change", syncCameraOption)
    return () => {
      mq1.removeEventListener("change", syncCameraOption)
      mq2.removeEventListener("change", syncCameraOption)
    }
  }, [open, resetAll])

  useEffect(() => {
    if (!loadingOverlayOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [loadingOverlayOpen])

  const runResearch = useCallback(
    async (rawDataUrl: string) => {
      researchLoadingStartedAtRef.current = Date.now()
      setStage("loading")
      setError(null)
      setAnswer(null)
      setFakeProgress(2)
      setLoadingMsg(pickLoadingMessage())

      const revealOutcome = async (payload: {
        answer: string | null
        error: string | null
        settlingMs?: number
      }) => {
        stopLoadingMotion()
        setFakeProgress(100)
        setLoadingMsg(
          payload.error
            ? "Couldn't finish that lookup."
            : "Done — here is your estimate."
        )
        const waitMs = payload.settlingMs ?? 2_600
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs))
        setError(payload.error)
        setAnswer(payload.answer)
        setStage("done")
      }

      try {
        let jpegDataUrl = rawDataUrl
        if (!jpegDataUrl.startsWith("data:image/jpeg")) {
          try {
            jpegDataUrl = await dataUrlToJpegDataUrl(rawDataUrl, 1600, 0.92)
          } catch {
            await revealOutcome({
              answer: null,
              error: "We couldn't process that image. Try another photo.",
              settlingMs: 1_450,
            })
            return
          }
        }

        setPreviewUrl(jpegDataUrl)

        const imageBase64 = dataUrlToRawBase64(jpegDataUrl)
        if (!imageBase64 || imageBase64.length < 100) {
          await revealOutcome({
            answer: null,
            error: "That photo couldn't be used. Try a clearer image.",
            settlingMs: 1_450,
          })
          return
        }

        const { data, error: fnError } = await supabase.functions.invoke(
          "research-card-price",
          { body: { imageBase64 } }
        )

        if (fnError) {
          logAskAiDevDetail("research-card-price invoke", fnError)
          await revealOutcome({
            answer: null,
            error:
              "We couldn't complete the request. Check your connection and try again.",
          })
          return
        }
        if (data === null || data === undefined) {
          await revealOutcome({
            answer: null,
            error: "No result came back. Please try again.",
          })
          return
        }
        if (typeof data === "object" && data !== null && "error" in data) {
          const msg = (data as { error?: string }).error
          if (msg) {
            logAskAiDevDetail("research-card-price response error field", msg)
            await revealOutcome({
              answer: null,
              error: "We couldn't finish this lookup. Please try again.",
            })
            return
          }
        }

        let resolvedAnswer: string | null = null
        if (typeof data === "object" && data !== null) {
          if ("answer" in data) {
            const ans = (data as { answer?: unknown }).answer
            if (typeof ans === "string") {
              resolvedAnswer = ans
            } else if (ans !== null && typeof ans === "object") {
              resolvedAnswer = JSON.stringify(ans, null, 2)
            }
          }
        }
        if (resolvedAnswer === null) {
          resolvedAnswer =
            typeof data === "string" ? data : JSON.stringify(data, null, 2)
        }

        await revealOutcome({ answer: resolvedAnswer, error: null })
      } catch (e) {
        logAskAiDevDetail("research-card-price unexpected", e)
        await revealOutcome({
          answer: null,
          error: "Something went wrong. Please try again.",
        })
      }
    },
    [stopLoadingMotion]
  )

  useEffect(() => {
    if (stage !== "loading") {
      stopLoadingMotion()
      return
    }

    const tickProgress = () => {
      const elapsedSec =
        (Date.now() - researchLoadingStartedAtRef.current) / 1000
      const fromTime = progressFromElapsedSeconds(elapsedSec)
      setFakeProgress((prev) =>
        Math.max(prev, Math.min(LOADING_PROGRESS_CAP, fromTime))
      )
    }
    tickProgress()
    progressIntervalRef.current = setInterval(tickProgress, 680)

    const scheduleMsg = () => {
      setLoadingMsg((prev) => pickLoadingMessage(prev))
      const delay = 5200 + Math.random() * 4200
      msgTimeoutRef.current = setTimeout(scheduleMsg, delay)
    }
    msgTimeoutRef.current = setTimeout(
      scheduleMsg,
      4500 + Math.random() * 2800
    )

    return () => {
      stopLoadingMotion()
    }
  }, [stage, stopLoadingMotion])

  const handleAlbumChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const input = albumInputRef.current ?? e.currentTarget
      const file = input.files?.[0]
      if (!file) {
        releaseAlbumPickerGuard()
        return
      }
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file (JPEG, PNG, WebP, etc.).")
        releaseAlbumPickerGuard()
        return
      }
      const maxBytes = 8 * 1024 * 1024
      if (file.size > maxBytes) {
        setError("Image must be 8 MB or smaller.")
        releaseAlbumPickerGuard()
        return
      }
      setError(null)
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result !== "string" || !result.startsWith("data:image/")) {
          setError("We couldn't read that file. Try a different image.")
          releaseAlbumPickerGuard()
          return
        }
        input.value = ""
        releaseAlbumPickerGuard()
        void runResearch(result)
      }
      reader.onerror = () => {
        setError("Failed to read the file.")
        releaseAlbumPickerGuard()
      }
      reader.readAsDataURL(file)
    },
    [releaseAlbumPickerGuard, runResearch]
  )

  const openCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      streamRef.current = stream
      setStage("camera")
    } catch {
      setError("Could not access the camera. Check permissions or try Album.")
      setStage("pick")
    }
  }, [])

  useEffect(() => {
    if (stage !== "camera") return
    const v = videoRef.current
    const s = streamRef.current
    if (!v || !s) return
    v.srcObject = s
    void v.play().catch(() => {})
    return () => {
      v.srcObject = null
    }
  }, [stage])

  const captureFromCamera = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.videoWidth < 2 || video.videoHeight < 2) {
      setError("Camera is not ready yet. Wait a moment and try again.")
      return
    }
    stopCamera()
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const g = canvas.getContext("2d")
    if (!g) {
      setError("Could not read camera frame.")
      setStage("pick")
      return
    }
    g.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    void runResearch(dataUrl)
  }, [runResearch, stopCamera])

  const closeEntireFlow = useCallback(() => {
    stopCamera()
    resetAll()
    onOpenChange(false)
  }, [onOpenChange, resetAll, stopCamera])

  useEffect(() => {
    if (!loadingOverlayOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        closeEntireFlow()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [closeEntireFlow, loadingOverlayOpen])

  const onChooserOpenChange = (next: boolean) => {
    if (!next) {
      stopCamera()
      resetAll()
      onOpenChange(false)
    }
  }

  const onResultOpenChange = (next: boolean) => {
    if (!next) {
      stopCamera()
      resetAll()
      onOpenChange(false)
    }
  }

  const askAgainFromResult = () => {
    setError(null)
    setAnswer(null)
    setPreviewUrl(null)
    setFakeProgress(0)
    setLoadingMsg(pickLoadingMessage())
    setStage("pick")
  }

  const optionBtnClass =
    "h-28 flex-col items-center justify-center gap-2 text-center whitespace-normal"

  const loadingModal =
    loadingOverlayOpen &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-6 backdrop-blur-md supports-backdrop-filter:bg-black/35 motion-reduce:backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={loadingTitleId}
      >
        <div className="relative flex max-w-md flex-col items-center gap-8 rounded-2xl border border-foreground/10 bg-popover/95 px-10 py-12 text-center shadow-2xl ring-1 ring-foreground/5 supports-backdrop-filter:bg-popover/80">
          <div className="space-y-2">
            <h2
              id={loadingTitleId}
              className="font-heading text-lg font-medium text-foreground"
            >
              Researching price
            </h2>
            <p className="text-sm text-muted-foreground">
              Estimating from your card photo — this can take up to a minute.
            </p>
          </div>
          <AskAiCircularProgress
            progress={fakeProgress}
            labelId={loadingTitleId}
          />
          <p className="min-h-[3.25rem] max-w-xs text-sm leading-relaxed text-muted-foreground motion-reduce:transition-none">
            {loadingMsg}
          </p>
        </div>
      </div>,
      document.body
    )

  return (
    <>
      {open ? (
        <input
          ref={albumInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/*"
          className="sr-only"
          onChange={handleAlbumChange}
        />
      ) : null}

      {showChooser ? (
        <Dialog open onOpenChange={onChooserOpenChange}>
        <DialogContent
          className="flex max-h-[min(90dvh,85vh)] min-h-0 min-w-0 w-full max-w-lg flex-col gap-0 p-0 sm:max-w-xl"
          onPointerDownOutside={(ev) => {
            if (albumPickerGuardRef.current) ev.preventDefault()
          }}
          onInteractOutside={(ev) => {
            if (albumPickerGuardRef.current) ev.preventDefault()
          }}
        >
          {stage === "pick" ? (
            <>
              <DialogHeader className="shrink-0 px-4 pt-4 pr-12 sm:px-6 sm:pt-6">
                <DialogTitle>Ask AI</DialogTitle>
                <DialogDescription className="sr-only">
                  Choose camera or photo library to add a card picture.
                </DialogDescription>
              </DialogHeader>
              <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                <div
                  className={cn(
                    "mt-2 grid gap-3",
                    showCameraOption ? "grid-cols-2" : "grid-cols-1"
                  )}
                >
                  {showCameraOption ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={optionBtnClass}
                      onClick={() => void openCamera()}
                    >
                      <Camera aria-hidden className="size-9" />
                      <span className="break-words text-sm font-medium leading-tight">
                        Camera
                      </span>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className={optionBtnClass}
                    onClick={() => {
                      albumPickerGuardRef.current = true
                      if (albumPickerReleaseTimerRef.current) {
                        clearTimeout(albumPickerReleaseTimerRef.current)
                      }
                      albumPickerReleaseTimerRef.current = window.setTimeout(
                        () => {
                          albumPickerGuardRef.current = false
                          albumPickerReleaseTimerRef.current = null
                        },
                        120_000
                      )
                      albumInputRef.current?.click()
                    }}
                  >
                    <ImageIcon aria-hidden className="size-9" />
                    <span className="break-words text-sm font-medium leading-tight">
                      Album
                    </span>
                  </Button>
                </div>
                {error ? (
                  <p className="mt-3 text-center text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                {!showCameraOption ? (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Use Album to choose a photo from your device.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {stage === "camera" ? (
            <>
              <DialogHeader className="shrink-0 px-4 pt-4 pr-12 sm:px-6 sm:pt-6">
                <DialogTitle>Capture card</DialogTitle>
                <DialogDescription>
                  Frame the card in good light, then tap Capture.
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="flex min-h-0 flex-col gap-4 px-4 sm:px-6">
                <div className="relative overflow-hidden rounded-xl border border-border bg-black/90">
                  <video
                    ref={videoRef}
                    className="aspect-[4/3] w-full object-cover"
                    playsInline
                    muted
                    autoPlay
                  />
                </div>
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
              </DialogBody>
              <DialogFooter className="shrink-0 border-t px-4 py-3 sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    stopCamera()
                    setError(null)
                    setStage("pick")
                  }}
                >
                  Back
                </Button>
                <Button type="button" onClick={() => void captureFromCamera()}>
                  Capture
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      ) : null}

      {loadingModal}

      {showResult ? (
        <Dialog open onOpenChange={onResultOpenChange}>
        <DialogContent className="flex max-h-[min(90dvh,85vh)] min-h-0 min-w-0 w-full max-w-lg flex-col gap-0 p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 px-4 pt-4 pr-12 sm:px-6 sm:pt-6">
            <DialogTitle>Result</DialogTitle>
            <DialogDescription className="sr-only">
              Price estimate and details for your card.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex min-h-0 flex-col gap-4 px-4 sm:px-6">
            {previewUrl ? (
              <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
                <img
                  src={previewUrl}
                  alt="Card used for research"
                  className="mx-auto max-h-40 w-full max-w-md object-contain"
                />
              </div>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive sm:text-sm">
                {error}
              </p>
            ) : null}

            {answer !== null && !error ? (
              <div className="flex min-h-[10rem] flex-col gap-2">
                <div
                  className="max-h-[min(50dvh,22rem)] flex-1 overflow-auto rounded-lg border border-border bg-muted/25 p-3 font-mono text-xs whitespace-pre-wrap sm:text-sm"
                >
                  {answer}
                </div>
              </div>
            ) : null}

            {!answer && !error ? (
              <p className="text-sm text-muted-foreground">
                No estimate was returned. Try another photo.
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter className="shrink-0 border-t px-4 py-3 sm:px-6">
            <Button type="button" variant="outline" onClick={closeEntireFlow}>
              Close
            </Button>
            <Button type="button" onClick={askAgainFromResult}>
              Ask again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}
    </>
  )
}
