import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { useRegistrationStore } from "@/stores/registration"
import { useNavigate } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

const otpSchema = z.object({
  token: z
    .string()
    .regex(/^[0-9]{6}$/, "Enter the 6-digit code")
    .transform((v) => v.trim()),
})

type OtpFormValues = z.infer<typeof otpSchema>

export function Otp() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const intent = useRegistrationStore((s) => s.intent)
  const clearIntent = useRegistrationStore((s) => s.clearIntent)
  const email = intent?.email

  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { token: "" },
    mode: "onSubmit",
  })

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-6 pb-14">
        <header className="text-center">
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Verify OTP</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the 6-digit code sent to your email.
          </p>
        </header>

        <Card className="mx-auto mt-8 w-full max-w-sm">
          <CardHeader className="text-left">
            <CardTitle>Confirmation code</CardTitle>
            <CardDescription>
              {email ? `We sent a code to ${email}.` : "We sent a code to your email."}
            </CardDescription>
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
              clearIntent()
              navigate({ to: "/user/dashboard" })
            })}
          >
            <CardContent className="mb-4">
              <div className="grid gap-2">
                <Label htmlFor="token">OTP</Label>
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

            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Verifying..." : "Verify"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate({ to: "/auth/login" })}
              >
                Back to login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}

