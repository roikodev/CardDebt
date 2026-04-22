import { useMemo } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { useNavigate } from "@tanstack/react-router"
import {
  CreditCard,
  HandCoins,
  LogOut,
  Settings,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

export function Dashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const initials = useMemo(() => {
    const email = user?.email ?? ""
    const trimmed = email.trim()
    if (!trimmed) return "U"
    return trimmed.slice(0, 2).toUpperCase()
  }, [user?.email])

  async function handleSignOut() {
    await supabase.auth.signOut()
    clearAuth()
    navigate({ to: "/auth/login" })
  }

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-left">
            <h1 className="truncate text-xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back{user?.email ? `, ${user.email}` : ""}.
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="p-1">
                <Avatar className="size-9">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                {user?.email ?? "Account"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate({ to: "/user/dashboard" })}
              >
                <Settings data-icon="inline-start" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut data-icon="inline-start" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator className="my-6" />

        <div className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
          <section className="min-w-0">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                className="shine-button h-20 w-full justify-start bg-gradient-to-br from-emerald-500 to-emerald-700 px-10 text-2xl font-semibold text-white shadow-md shadow-emerald-500/15 ring-1 ring-white/10 hover:from-emerald-400 hover:to-emerald-700 active:translate-y-px"
              >
                <ShoppingCart
                  data-icon="inline-start"
                  aria-hidden="true"
                  className="size-6"
                />
                Buy
              </Button>
              <Button
                type="button"
                className="shine-button h-20 w-full justify-start bg-gradient-to-br from-rose-500 to-rose-700 px-10 text-2xl font-semibold text-white shadow-md shadow-rose-500/15 ring-1 ring-white/10 hover:from-rose-400 hover:to-rose-700 active:translate-y-px"
              >
                <HandCoins data-icon="inline-start" aria-hidden="true" className="size-6" />
                Sell
              </Button>
              <Button
                type="button"
                className="shine-button col-span-2 h-20 w-full justify-start bg-gradient-to-br from-violet-500 to-violet-700 px-10 text-2xl font-semibold text-white shadow-md shadow-violet-500/15 ring-1 ring-white/10 hover:from-violet-400 hover:to-violet-700 active:translate-y-px"
              >
                <CreditCard data-icon="inline-start" aria-hidden="true" className="size-6" />
                Miscellaneous
              </Button>
            </div>
          </section>

          <section className="min-w-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total balance</CardTitle>
                </CardHeader>
                <CardContent className="text-left">
                  <p className="text-2xl font-semibold tracking-tight">$4,820.00</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <TrendingDown data-icon="inline-start" aria-hidden="true" />
                    2.1% vs last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">This month paid</CardTitle>
                </CardHeader>
                <CardContent className="text-left">
                  <p className="text-2xl font-semibold tracking-tight">$560.00</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <TrendingUp data-icon="inline-start" aria-hidden="true" />
                    On track
                  </p>
                </CardContent>
              </Card>

              <Card className="sm:col-span-2 lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Next due</CardTitle>
                </CardHeader>
                <CardContent className="text-left">
                  <p className="text-2xl font-semibold tracking-tight">May 3</p>
                  <p className="mt-1 text-sm text-muted-foreground">$120 minimum payment</p>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="text-left">
                <div className="flex flex-col gap-2">
                  <Button type="button" className="justify-start">
                    Add a transaction
                  </Button>
                  <Button type="button" variant="outline" className="justify-start">
                    Add a card
                  </Button>
                  <Button type="button" variant="outline" className="justify-start">
                    Set monthly goal
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent className="text-left">
                <p className="text-sm text-muted-foreground">
                  You’re signed in and ready. Next step: connect your real data model and render
                  live numbers here.
                </p>
              </CardContent>
            </Card>
          </div>
      </div>
    </main>
  )
}

