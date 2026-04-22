import { useEffect, useMemo, useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

type NavItem = {
  title: string
  to: "/user/dashboard"
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const navItems: NavItem[] = [
  { title: "Dashboard", to: "/user/dashboard", icon: LayoutDashboard },
]

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-lg border bg-card/60">
          <CreditCard aria-hidden="true" />
        </div>
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-medium leading-none">Card Debt</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">User</p>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.title}
                asChild
                variant="ghost"
                className="justify-start"
                onClick={() => onNavigate?.()}
              >
                <Link to={item.to}>
                  <Icon data-icon="inline-start" aria-hidden="true" />
                  {item.title}
                </Link>
              </Button>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-2">
        <Button asChild variant="ghost" className="w-full justify-start">
          <Link to="/user/dashboard">
            <Settings data-icon="inline-start" aria-hidden="true" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const initials = useMemo(() => {
    const email = user?.email ?? ""
    const trimmed = email.trim()
    if (!trimmed) return "U"
    return trimmed.slice(0, 2).toUpperCase()
  }, [user?.email])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [mobileMenuOpen])

  useEffect(() => {
    if (mobileMenuOpen) return

    let startX: number | null = null
    let startY: number | null = null
    let startedAt = 0

    const edgePx = 24
    const minDx = 70
    const maxDy = 45
    const maxMs = 650

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      if (t.clientX > edgePx) return
      startX = t.clientX
      startY = t.clientY
      startedAt = Date.now()
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startX == null || startY == null) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY

      if (Date.now() - startedAt > maxMs) {
        startX = null
        startY = null
        return
      }

      if (dx > minDx && Math.abs(dy) < maxDy) {
        setMobileMenuOpen(true)
        startX = null
        startY = null
      }
    }

    const onTouchEnd = () => {
      startX = null
      startY = null
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [mobileMenuOpen])

  async function handleSignOut() {
    await supabase.auth.signOut()
    clearAuth()
    navigate({ to: "/auth/login" })
  }

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu data-icon="inline-start" aria-hidden="true" />
          </Button>

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

        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <aside className="hidden h-[calc(100svh-190px)] rounded-xl border bg-card/30 md:block">
            <SidebarNav />
          </aside>

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
                    You’re signed in and ready. Next step: connect your real data model and
                    render live numbers here.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>

      <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} direction="left">
        <DrawerContent className="h-full">
          <DrawerHeader>
            <DrawerTitle>Menu</DrawerTitle>
            <DrawerDescription className="sr-only">
              Navigation menu for the dashboard.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1">
            <SidebarNav onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  )
}

