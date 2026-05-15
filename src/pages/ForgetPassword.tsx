import { useEffect, useMemo, useState } from "react"

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
import { PasswordPolicyHint } from "@/components/auth/PasswordPolicyHint"
import { cn } from "@/lib/utils"
import {
  emailOnlySchema,
  newPasswordSchema,
  otpSchema,
} from "@/lib/i18nValidation"
import {
  isPasswordRecoveryFlowValid,
  usePasswordRecoveryStore,
} from "@/stores/passwordRecovery"
import { Link, useNavigate } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { CheckCircle2 } from "lucide-react"
import type { z } from "zod"
import { useTranslation } from "react-i18next"

export function ForgetPassword() {
  const { t } = useTranslation()
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

  const emailSchema = useMemo(() => emailOnlySchema(t), [t])
  const otpFormSchema = useMemo(() => otpSchema(t), [t])
  const passwordSchemaResolved = useMemo(() => newPasswordSchema(t), [t])

  type EmailForm = z.infer<ReturnType<typeof emailOnlySchema>>
  type OtpFormValues = z.infer<ReturnType<typeof otpSchema>>
  type NewPasswordFormValues = z.infer<ReturnType<typeof newPasswordSchema>>

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

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: { token: "" },
    mode: "onSubmit",
  })

  const passwordForm = useForm<NewPasswordFormValues>({
    resolver: zodResolver(passwordSchemaResolved),
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
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">
              {t("auth.forgetPassword.updatedTitle")}
            </h1>
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
                {t("auth.forgetPassword.updatedBody")}
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
                {t("auth.forgetPassword.backLogin")}
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
              {t("auth.forgetPassword.checkEmailTitle")}
            </h1>
          </header>

          <Card className="mx-auto mt-8 w-full max-w-sm">
            <CardHeader className="text-left">
              <CardTitle>{t("auth.forgetPassword.resetCodeTitle")}</CardTitle>
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
                    {t("auth.forgetPassword.enterCodeSent", { email })}
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
                  {otpForm.formState.isSubmitting
                    ? t("auth.forgetPassword.verifying")
                    : t("auth.forgetPassword.continue")}
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
                  {t("auth.forgetPassword.useDifferentEmail")}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Button asChild type="button" variant="ghost" className="mx-auto mt-4 w-fit">
            <Link to="/auth/login">{t("auth.forgetPassword.backLoginLink")}</Link>
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
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">
              {t("auth.forgetPassword.newPasswordPageTitle")}
            </h1>
          </header>

          <Card className="mx-auto mt-8 w-full max-w-sm">
            <CardHeader className="text-left">
              <CardTitle>{t("auth.forgetPassword.setPasswordCardTitle")}</CardTitle>
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
                    <Label htmlFor="new-password">{t("auth.password")}</Label>
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
                    <Label htmlFor="confirm-new-password">
                      {t("auth.forgetPassword.confirmPassword")}
                    </Label>
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
                  {passwordForm.formState.isSubmitting
                    ? t("auth.forgetPassword.saving")
                    : t("auth.forgetPassword.updatePassword")}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Button asChild type="button" variant="ghost" className="mx-auto mt-4 w-fit">
            <Link to="/auth/login">{t("auth.forgetPassword.backLoginLink")}</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="text-foreground">
      <div className="mx-auto w-full max-w-md px-6 pb-14">
        <header className="text-center">
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            {t("auth.forgetPassword.initialPageTitle")}
          </h1>
        </header>

        <Card className="mx-auto mt-8 w-full max-w-sm">
          <CardHeader className="text-left">
            <CardTitle>{t("auth.forgetPassword.yourEmailCardTitle")}</CardTitle>
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
                <Label htmlFor="recovery-email">{t("auth.email")}</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder={t("auth.emailPlaceholder")}
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
                {emailForm.formState.isSubmitting
                  ? t("auth.forgetPassword.sending")
                  : t("auth.forgetPassword.sendCode")}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Button asChild type="button" variant="ghost" className="mx-auto mt-4 w-fit">
          <Link to="/auth/login">{t("auth.forgetPassword.backLoginLink")}</Link>
        </Button>
      </div>
    </main>
  )
}
