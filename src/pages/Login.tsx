import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleIcon } from "@/components/icons/GoogleIcon"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Link, useNavigate } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useAuthStore } from "@/stores/auth"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  })

  return (
    <main className="text-foreground">
      <div className="mx-auto w-full max-w-md px-6 pb-14">
        <header className="text-center">
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Login</h1>
        </header>

        <Card className="mx-auto mt-8 w-full max-w-sm">
          <CardHeader className="text-left">
            <CardTitle>Login to your account</CardTitle>
            <CardAction>
              <Button asChild type="button">
                <Link to="/auth/signup">Sign Up</Link>
              </Button>
            </CardAction>
          </CardHeader>

          <form
            noValidate
            onSubmit={handleSubmit(async (values) => {
              setSubmitError(null)

              const { error } = await supabase.auth.signInWithPassword({
                email: values.email,
                password: values.password,
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
              navigate({ to: "/user/dashboard" })
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
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/auth/forget-password"
                      className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
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
            </CardContent>

            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Logging in..." : "Login"}
              </Button>

              <div className="h-px w-full bg-border" role="presentation" />

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  // TODO: wire up Google OAuth next
                }}
              >
                <GoogleIcon className="mr-2 h-4 w-4" />
                Login with Google
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Button asChild type="button" variant="ghost" className="mx-auto mt-4 w-fit">
          <Link to="/auth/home">Back</Link>
        </Button>
      </div>
    </main>
  )
}
