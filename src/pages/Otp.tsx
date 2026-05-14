import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { useRegistrationStore } from "@/stores/registration"
import { useNavigate } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { Sparkles } from "lucide-react"
import { z } from "zod"

const WELCOME_DASHBOARD_ZOOM_KEY = "carddebt:welcome-dashboard-zoom"

const otpSchema = z.object({
  token: z
    .string()
    .regex(/^[0-9]{6}$/, "Enter the 6-digit code")
    .transform((v) => v.trim()),
})

type OtpFormValues = z.infer<typeof otpSchema>

function pickWelcomeName(email: string | null | undefined): string | null {
  if (!email) return null
  const local = email.split("@")[0]?.trim()
  if (!local) return null
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export function Otp() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const intent = useRegistrationStore((s) => s.intent)
  const clearIntent = useRegistrationStore((s) => s.clearIntent)
  const email = intent?.email

  const [phase, setPhase] = useState<"otp" | "welcome">("otp")
  const [welcomeName, setWelcomeName] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const leavingNavigated = useRef(false)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { token: "" },
    mode: "onSubmit",
  })

  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute("data-hero-celebrate")
    }
  }, [])

  useEffect(() => {
    if (phase !== "welcome") return
    const id = requestAnimationFrame(() => {
      document.documentElement.setAttribute("data-hero-celebrate", "")
    })
    return () => cancelAnimationFrame(id)
  }, [phase])

  function goToDashboard() {
    if (leavingNavigated.current) return
    leavingNavigated.current = true
    sessionStorage.setItem(WELCOME_DASHBOARD_ZOOM_KEY, "1")
    clearIntent()
    void navigate({ to: "/user/dashboard" })
  }

  function handleLetsStart() {
    if (isLeaving || leavingNavigated.current) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      goToDashboard()
      return
    }
    setIsLeaving(true)
  }

  function onExitTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (!isLeaving || leavingNavigated.current) return
    if (e.target !== e.currentTarget) return
    if (e.propertyName !== "opacity" && e.propertyName !== "transform") return
    goToDashboard()
  }

  return (
    <main className="text-foreground">
      <div
        className={cn(
          "mx-auto w-full max-w-md px-6 pb-14 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
          isLeaving && "scale-[0.92] opacity-0 motion-reduce:scale-100 motion-reduce:opacity-100",
        )}
        onTransitionEnd={onExitTransitionEnd}
      >
        <header className="text-center">
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            {phase === "welcome" ? "You're all set" : "Verify OTP"}
          </h1>
        </header>

        {phase === "otp" ? (
          <Card className="mx-auto mt-8 w-full max-w-sm">
            <CardHeader className="text-left">
              <CardTitle>Confirmation code</CardTitle>
            </CardHeader>

            <form
              noValidate
              onSubmit={handleSubmit(async (values) => {
                setSubmitError(null)
                if (!email) {
                  setSubmitError("Missing email. Please sign up again.")
                  return
                }

                const { error } = await supabase.auth.verifyOtp({
                  email,
                  token: values.token,
                  type: "signup",
                })

                if (error) {
                  setSubmitError(error.message)
                  return
                }

                const [{ data: userData }, { data: sessionData }] = await Promise.all([
                  supabase.auth.getUser(),
                  supabase.auth.getSession(),
                ])
                const session = sessionData.session
                setAuth({
                  user: userData.user
                    ? { id: userData.user.id, email: userData.user.email ?? null }
                    : null,
                  session: session
                    ? {
                        accessToken: session.access_token,
                        refreshToken: session.refresh_token,
                        expiresAt: session.expires_at ?? null,
                        tokenType: session.token_type ?? null,
                      }
                    : null,
                })
                setWelcomeName(pickWelcomeName(userData.user?.email ?? email))
                setPhase("welcome")
              })}
            >
              <CardContent className="mb-4">
                <div className="grid gap-2">
                  <Label htmlFor="token" className="text-pretty">
                    {email ? (
                      <>
                        Enter the code we sent to{" "}
                        <span className="font-medium break-all">{email}</span>
                      </>
                    ) : (
                      "Enter the 6-digit code from your email."
                    )}
                  </Label>
                  <Controller
                    control={control}
                    name="token"
                    render={({ field }) => (
                      <InputOTP
                        {...field}
                        id="token"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        aria-invalid={errors.token ? "true" : "false"}
                        onChange={(value) => field.onChange(value)}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    )}
                  />
                  {errors.token ? (
                    <p className="text-xs text-destructive">{errors.token.message}</p>
                  ) : null}
                </div>

                {submitError ? (
                  <p className="mt-4 text-sm text-destructive">{submitError}</p>
                ) : null}
              </CardContent>

              <CardFooter className="flex flex-col items-stretch gap-3">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Verifying..." : "Verify"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="self-center w-fit"
                  onClick={() => navigate({ to: "/auth/login" })}
                >
                  Back to login
                </Button>
              </CardFooter>
            </form>
          </Card>
        ) : (
          <Card className="mx-auto mt-8 w-full max-w-sm">
            <CardHeader className="text-left">
              <div className="flex items-start gap-3">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20"
                  aria-hidden
                >
                  <Sparkles className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <CardTitle>Welcome to CardDebt</CardTitle>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {welcomeName ? (
                      <>
                        Hi {welcomeName} — your email is verified. Track what you spend on cards,
                        grading, and pickups in one place. Dive in whenever you are ready.
                      </>
                    ) : (
                      <>
                        Your email is verified. Track what you spend on cards, grading, and pickups
                        in one place. Dive in whenever you are ready.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardFooter className="flex flex-col items-stretch gap-3 pt-2">
              <Button type="button" className="w-full" onClick={handleLetsStart}>
                Let&apos;s Start
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </main>
  )
}
