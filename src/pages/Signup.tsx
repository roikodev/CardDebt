import { useMemo, useState } from "react"

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
import { PasswordPolicyHint } from "@/components/auth/PasswordPolicyHint"
import { signupSchema } from "@/lib/i18nValidation"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Link, useNavigate } from "@tanstack/react-router"
import { useRegistrationStore } from "@/stores/registration"
import { useAuthStore } from "@/stores/auth"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

type SignupFormValues = z.infer<ReturnType<typeof signupSchema>>

export function Signup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const startIntent = useRegistrationStore((s) => s.startIntent)
  const setAuth = useAuthStore((s) => s.setAuth)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitNote, setSubmitNote] = useState<string | null>(null)

  const schema = useMemo(() => signupSchema(t), [t])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  })

  return (
    <main className="text-foreground">
      <div className="mx-auto w-full max-w-md px-6 pb-14">
        <header className="text-center">
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("auth.signup.title")}</h1>
        </header>

        <Card className="mx-auto mt-8 w-full max-w-sm">
          <CardHeader className="text-left">
            <CardTitle>{t("auth.signup.cardTitle")}</CardTitle>
          </CardHeader>

          <form
            noValidate
            onSubmit={handleSubmit(async (values) => {
              setSubmitError(null)
              setSubmitNote(null)

              const { error, data } = await supabase.auth.signUp({
                email: values.email,
                password: values.password,
              })

              if (error) {
                setSubmitError(error.message)
                return
              }

              // Supabase may return a user with no identities for existing emails
              // (to prevent account enumeration). Treat that as "already exists".
              if (
                data.user &&
                Array.isArray(data.user.identities) &&
                data.user.identities.length === 0
              ) {
                setSubmitError(t("auth.signup.userExists"))
                return
              }

              if (data.session) {
                setSubmitNote(t("auth.signup.signedInNote"))
                setAuth({
                  user: data.user ? { id: data.user.id, email: data.user.email ?? null } : null,
                  session: {
                    accessToken: data.session.access_token,
                    refreshToken: data.session.refresh_token,
                    expiresAt: data.session.expires_at ?? null,
                    tokenType: data.session.token_type ?? null,
                  },
                })
                navigate({ to: "/user/dashboard" })
              } else {
                startIntent(values.email)
                navigate({
                  to: "/auth/otp",
                })
              }
            })}
          >
            <CardContent className="mb-4">
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder={t("auth.emailPlaceholder")}
                    aria-invalid={errors.email ? "true" : "false"}
                    className={cn(errors.email && "border-destructive")}
                    {...register("email")}
                  />
                  {errors.email ? (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <PasswordPolicyHint id="signup-password-policy" />
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={errors.password ? "true" : "false"}
                    aria-describedby="signup-password-policy"
                    className={cn(errors.password && "border-destructive")}
                    {...register("password")}
                  />
                  {errors.password ? (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  ) : null}
                </div>
              </div>

              {submitError ? (
                <p className="mt-4 text-sm text-destructive">{submitError}</p>
              ) : null}
              {submitNote ? (
                <p className="mt-4 text-sm text-muted-foreground">{submitNote}</p>
              ) : null}
            </CardContent>

            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t("auth.signup.submitting") : t("auth.signup.submit")}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Button asChild type="button" variant="ghost" className="mx-auto mt-4 w-fit">
          <Link to="/auth/login">{t("auth.signup.backLogin")}</Link>
        </Button>
      </div>
    </main>
  )
}

