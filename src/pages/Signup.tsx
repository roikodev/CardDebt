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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Link, useNavigate } from "@tanstack/react-router"
import { useRegistrationStore } from "@/stores/registration"
import { useAuthStore } from "@/stores/auth"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type SignupFormValues = z.infer<typeof signupSchema>

export function Signup() {
  const navigate = useNavigate()
  const startIntent = useRegistrationStore((s) => s.startIntent)
  const setAuth = useAuthStore((s) => s.setAuth)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitNote, setSubmitNote] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  })

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-6 pb-14">
        <header className="text-center">
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sign up</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an account to sync your data across devices.
          </p>
        </header>

        <Card className="mx-auto mt-8 w-full max-w-sm">
          <CardHeader className="text-left">
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Enter your email and password to sign up</CardDescription>
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
                setSubmitError("User already exists")
                return
              }

              if (data.session) {
                setSubmitNote("Account created. You’re signed in.")
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="m@example.com"
                    aria-invalid={errors.email ? "true" : "false"}
                    className={cn(errors.email && "border-destructive")}
                    {...register("email")}
                  />
                  {errors.email ? (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={errors.password ? "true" : "false"}
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
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Button asChild type="button" variant="ghost" className="mx-auto mt-4 w-full max-w-sm">
          <Link to="/auth/login">Back</Link>
        </Button>
      </div>
    </main>
  )
}

