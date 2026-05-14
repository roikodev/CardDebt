import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { supabase } from "@/lib/supabase"
import { passwordFieldSchema } from "@/lib/passwordPolicy"
import { PasswordPolicyHint } from "@/components/auth/PasswordPolicyHint"
import { cn } from "@/lib/utils"
import {
  isPasswordRecoveryFlowValid,
  usePasswordRecoveryStore,
} from "@/stores/passwordRecovery"
import { Link, useNavigate } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { CheckCircle2 } from "lucide-react"
import { z } from "zod"

const emailSchema = z.object({
  email: z.string().email("Enter a valid email"),
})

type EmailForm = z.infer<typeof emailSchema>

const otpSchema = z.object({
  token: z
    .string()
    .regex(/^[0-9]{6}$/, "Enter the 6-digit code")
    .transform((v) => v.trim()),
})

type OtpForm = z.infer<typeof otpSchema>

const newPasswordSchema = z
  .object({
    password: passwordFieldSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type NewPasswordForm = z.infer<typeof newPasswordSchema>

export function ForgetPassword() {
  const navigate = useNavigate()
  const email = usePasswordRecoveryStore((s) => s.email)
  const phase = usePasswordRecoveryStore((s) => s.phase)
  const createdAt = usePasswordRecoveryStore((s) => s.createdAt)
  const beginFromEmail = usePasswordRecoveryStore((s) => s.beginFromEmail)
  const goToPasswordStep = usePasswordRecoveryStore((s) => s.goToPasswordStep)
  const resetToEmail = usePasswordRecoveryStore((s) => s.resetToEmail)
  const clear = usePasswordRecoveryStore((s) => s.clear)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [passwordUpdated, setPasswordUpdated] = useState(false)

  useEffect(() => {
    if (
      phase !== "idle" &&
      !isPasswordRecoveryFlowValid({ email, phase, createdAt })
    ) {
      resetToEmail()
    }
  }, [phase, email, createdAt, resetToEmail])

  useEffect(() => {
    if (phase !== "password" || passwordUpdated) return
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) resetToEmail()
    })
  }, [phase, resetToEmail, passwordUpdated])

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: email ?? "" },
    mode: "onSubmit",
  })

  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { token: "" },
    mode: "onSubmit",
  })

  const passwordForm = useForm<NewPasswordForm>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onSubmit",
  })

  async function sendRecoveryEmail(address: string) {
    const redirectTo = `${window.location.origin}/auth/forget-password`
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo,
    })
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("resetPasswordForEmail:", error.message)
    }
  }

  if (passwordUpdated) {
    return (
      <main className="text-foreground">
        <div className="mx-auto w-full max-w-md px-6 pb-14">
          <header className="text-center">
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Password updated</h1>
          </header>

          <Card className="mx-auto mt-8 w-full max-w-sm">
            <CardContent className="flex flex-col items-center px-6 pt-8 pb-2 text-center">
              <div
                className="mb-4 flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                aria-hidden
              >
                <CheckCircle2 className="size-8" strokeWidth={2} />
              </div>
              <p className="text-sm text-muted-foreground">
                Your password has been updated successfully. Use the button below to return to the
                login page and sign in with your new password.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch px-6 pb-4 pt-2">
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setPasswordUpdated(false)
                  navigate({ to: "/auth/login" })
                }}
              >
                Back to Login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    )
  }

  if (phase === "otp" && email) {
    return (
      <main className="text-foreground">
        <div className="mx-auto w-full max-w-md px-6 pb-14">
          <header className="text-center">
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">
              Check your email
            </h1>
          </header>

          <Card className="mx-auto mt-8 w-full max-w-sm">
            <CardHeader className="text-left">
              <CardTitle>Reset code</CardTitle>
            </CardHeader>

            <form
              noValidate
              onSubmit={otpForm.handleSubmit(async (values) => {
                setSubmitError(null)
                const { error } = await supabase.auth.verifyOtp({
                  email,
                  token: values.token,
                  type: "recovery",
                })
                if (error) {
                  setSubmitError(error.message)
                  return
                }
                goToPasswordStep()
                otpForm.reset()
              })}
            >
              <CardContent className="mb-4">
                <div className="grid gap-2">
                  <Label htmlFor="recovery-token" className="text-pretty">
                    Enter the code sent to{" "}
                    <span className="font-medium break-all">{email}</span>
                  </Label>
                  <Controller
                    control={otpForm.control}
                    name="token"
                    render={({ field }) => (
                      <InputOTP
                        {...field}
                        id="recovery-token"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        aria-invalid={otpForm.formState.errors.token ? "true" : "false"}
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
                  {otpForm.formState.errors.token ? (
                    <p className="text-xs text-destructive">
                      {otpForm.formState.errors.token.message}
                    </p>
                  ) : null}
                  {submitError ? (
                    <p className="mt-4 text-sm text-destructive">{submitError}</p>
                  ) : null}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col items-stretch gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={otpForm.formState.isSubmitting}
                >
                  {otpForm.formState.isSubmitting ? "Verifying…" : "Continue"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="self-center w-fit"
                  onClick={async () => {
                    await supabase.auth.signOut()
                    resetToEmail()
                    otpForm.reset()
                    setSubmitError(null)
                    setPasswordUpdated(false)
                  }}
                >
                  Use a different email
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Button asChild type="button" variant="ghost" className="mx-auto mt-4 w-fit">
            <Link to="/auth/login">Back to login</Link>
          </Button>
        </div>
      </main>
    )
  }

  if (phase === "password" && email) {
    return (
      <main className="text-foreground">
        <div className="mx-auto w-full max-w-md px-6 pb-14">
          <header className="text-center">
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">New password</h1>
          </header>

          <Card className="mx-auto mt-8 w-full max-w-sm">
            <CardHeader className="text-left">
              <CardTitle>Set password</CardTitle>
            </CardHeader>

            <form
              noValidate
              onSubmit={passwordForm.handleSubmit(async (values) => {
                setSubmitError(null)
                const { error } = await supabase.auth.updateUser({
                  password: values.password,
                })
                if (error) {
                  setSubmitError(error.message)
                  return
                }
                await supabase.auth.signOut()
                clear()
                passwordForm.reset()
                setPasswordUpdated(true)
              })}
            >
              <CardContent className="mb-4">
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <PasswordPolicyHint id="reset-password-policy" />
                    <Label htmlFor="new-password">Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      aria-invalid={passwordForm.formState.errors.password ? "true" : "false"}
                      aria-describedby="reset-password-policy"
                      className={cn(
                        passwordForm.formState.errors.password && "border-destructive"
                      )}
                      {...passwordForm.register("password")}
                    />
                    {passwordForm.formState.errors.password ? (
                      <p className="text-xs text-destructive">
                        {passwordForm.formState.errors.password.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-new-password">Confirm password</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      autoComplete="new-password"
                      aria-invalid={
                        passwordForm.formState.errors.confirmPassword ? "true" : "false"
                      }
                      aria-describedby="reset-password-policy"
                      className={cn(
                        passwordForm.formState.errors.confirmPassword && "border-destructive"
                      )}
                      {...passwordForm.register("confirmPassword")}
                    />
                    {passwordForm.formState.errors.confirmPassword ? (
                      <p className="text-xs text-destructive">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                {submitError ? (
                  <p className="mt-4 text-sm text-destructive">{submitError}</p>
                ) : null}
              </CardContent>

              <CardFooter className="flex flex-col items-stretch gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={passwordForm.formState.isSubmitting}
                >
                  {passwordForm.formState.isSubmitting ? "Saving…" : "Update password"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Button asChild type="button" variant="ghost" className="mx-auto mt-4 w-fit">
            <Link to="/auth/login">Back to login</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="text-foreground">
      <div className="mx-auto w-full max-w-md px-6 pb-14">
        <header className="text-center">
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Forgot password</h1>
        </header>

        <Card className="mx-auto mt-8 w-full max-w-sm">
          <CardHeader className="text-left">
            <CardTitle>Your email</CardTitle>
          </CardHeader>

          <form
            noValidate
            onSubmit={emailForm.handleSubmit(async (values) => {
              setSubmitError(null)
              setPasswordUpdated(false)
              await sendRecoveryEmail(values.email.trim())
              beginFromEmail(values.email.trim())
            })}
          >
            <CardContent className="mb-4">
              <div className="grid gap-2">
                <Label htmlFor="recovery-email">Email</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="m@example.com"
                  aria-invalid={emailForm.formState.errors.email ? "true" : "false"}
                  className={cn(emailForm.formState.errors.email && "border-destructive")}
                  {...emailForm.register("email")}
                />
                {emailForm.formState.errors.email ? (
                  <p className="text-xs text-destructive">
                    {emailForm.formState.errors.email.message}
                  </p>
                ) : null}
                {submitError ? (
                  <p className="mt-4 text-sm text-destructive">{submitError}</p>
                ) : null}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-3">
              <Button
                type="submit"
                className="w-full"
                disabled={emailForm.formState.isSubmitting}
              >
                {emailForm.formState.isSubmitting ? "Sending…" : "Send reset code"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Button asChild type="button" variant="ghost" className="mx-auto mt-4 w-fit">
          <Link to="/auth/login">Back to login</Link>
        </Button>
      </div>
    </main>
  )
}
