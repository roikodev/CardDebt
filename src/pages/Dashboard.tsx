import { type ReactNode, useMemo, useState } from "react"

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
import { BuyProductDialog } from "@/components/dialogs/BuyProductDialog"
import { BuyProductByCardBaseDialog } from "@/components/dialogs/BuyProductByCardBaseDialog"
import { CardBaseDialog } from "@/components/dialogs/CardBaseDialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { useNavigate } from "@tanstack/react-router"
import {
  CreditCard,
  LayoutGrid,
  Folder,
  HandCoins,
  LogOut,
  PlusSquare,
  Settings,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

function GridGroup({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`col-span-12 grid grid-cols-12 gap-3 md:col-span-3 ${className}`.trim()}
    >
      {children}
    </section>
  )
}

function GridGroupBig({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`col-span-12 grid grid-cols-12 gap-3 md:col-span-6 ${className}`.trim()}
    >
      {children}
    </section>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [buyChooserOpen, setBuyChooserOpen] = useState(false)
  const [buyOpen, setBuyOpen] = useState(false)
  const [cardBaseOpen, setCardBaseOpen] = useState(false)
  const [buyByCardBaseOpen, setBuyByCardBaseOpen] = useState(false)
  const [selectedCardBaseItem, setSelectedCardBaseItem] =
    useState<import("@/components/dialogs/CardBaseDialog").CollectionBaseRow | null>(
      null
    )

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

        <div className="grid grid-cols-12 gap-3">
          <GridGroup>
            <Button
              type="button"
              className="shine-button-light relative col-span-12 h-full min-h-28 w-full items-stretch border border-border/80 bg-white p-6 text-black shadow-sm hover:bg-neutral-100 active:translate-y-px"
              onClick={() => navigate({ to: "/user/my-collection" })}
            >
              <Folder aria-hidden="true" className="absolute left-5 top-5 size-7" />
              <span className="absolute bottom-5 right-5 text-right text-2xl font-semibold leading-none lg:text-xl">
                My Collection
              </span>
            </Button>
          </GridGroup>

          <GridGroup>
            <Button
              type="button"
              className="shine-button-light relative col-span-6 min-h-28 w-full items-stretch border border-border/80 bg-white p-6 text-black shadow-sm hover:bg-neutral-100 active:translate-y-px"
              onClick={() => setBuyChooserOpen(true)}
            >
              <ShoppingCart aria-hidden="true" className="absolute left-5 top-5 size-7" />
              <span className="absolute bottom-5 right-5 text-right text-2xl font-semibold leading-none lg:text-xl">
                Buy
              </span>
            </Button>
            <Button
              type="button"
              className="shine-button-light relative col-span-6 min-h-28 w-full items-stretch border border-border/80 bg-white p-6 text-black shadow-sm hover:bg-neutral-100 active:translate-y-px"
            >
              <HandCoins aria-hidden="true" className="absolute left-5 top-5 size-7" />
              <span className="absolute bottom-5 right-5 text-right text-2xl font-semibold leading-none lg:text-xl">
                Sell
              </span>
            </Button>
            <Button
              type="button"
              className="shine-button relative col-span-12 min-h-28 w-full items-stretch border border-white/10 bg-black p-6 text-white shadow-sm hover:bg-neutral-900 active:translate-y-px"
            >
              <CreditCard aria-hidden="true" className="absolute left-5 top-5 size-7" />
              <span className="absolute bottom-5 right-5 text-right text-2xl font-semibold leading-none lg:text-xl">
                Miscellaneous
              </span>
            </Button>
          </GridGroup>

          <Dialog open={buyChooserOpen} onOpenChange={setBuyChooserOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Buy</DialogTitle>
                <DialogDescription>Choose how you want to add this purchase.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-28 flex-col items-center justify-center gap-2 text-center"
                  onClick={() => {
                    setBuyChooserOpen(false)
                    setBuyOpen(true)
                  }}
                >
                  <PlusSquare aria-hidden="true" className="size-9" />
                  <span className="whitespace-normal break-words text-sm font-medium leading-tight">
                    Create New
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-28 flex-col items-center justify-center gap-2 text-center"
                  onClick={() => {
                    setBuyChooserOpen(false)
                    // TODO: hook up Card Base chooser
                    setCardBaseOpen(true)
                  }}
                >
                  <LayoutGrid aria-hidden="true" className="size-9" />
                  <span className="whitespace-normal break-words text-sm font-medium leading-tight">
                    Choose from my Card Base
                  </span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <BuyProductDialog open={buyOpen} onOpenChange={setBuyOpen} />
          <CardBaseDialog
            open={cardBaseOpen}
            onOpenChange={setCardBaseOpen}
            onSelect={(item) => {
              setSelectedCardBaseItem(item)
              setBuyByCardBaseOpen(true)
            }}
          />
          <BuyProductByCardBaseDialog
            open={buyByCardBaseOpen}
            onOpenChange={setBuyByCardBaseOpen}
            item={selectedCardBaseItem}
          />

          <GridGroup>
            <Card className="col-span-12">
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
          </GridGroup>

          <GridGroup>
            <Card className="col-span-12">
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
          </GridGroup>

          <GridGroup>
            <Card className="col-span-12">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Next due</CardTitle>
              </CardHeader>
              <CardContent className="text-left">
                <p className="text-2xl font-semibold tracking-tight">May 3</p>
                <p className="mt-1 text-sm text-muted-foreground">$120 minimum payment</p>
              </CardContent>
            </Card>
          </GridGroup>

          <GridGroupBig className="md:col-span-6">
            <Card className="col-span-12">
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
          </GridGroupBig>

          <GridGroupBig className="md:col-span-6">
            <Card className="col-span-12">
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
          </GridGroupBig>
        </div>
      </div>
    </main>
  )
}

