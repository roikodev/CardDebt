import { Button } from "@/components/ui/button"
import cardDebtLogo from "@/assets/CardDebt.png"
import { Link } from "@tanstack/react-router"

export function Login() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-6 py-14">
        <header className="text-center">
          <img
            src={cardDebtLogo}
            alt="Card Debt app icon"
            className="mx-auto h-14 w-14 rounded-2xl border bg-card/60 object-cover shadow-sm"
            width={56}
            height={56}
            loading="eager"
            decoding="async"
          />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Login</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to sync your data across devices.
          </p>
        </header>

        <div className="mt-8 rounded-xl border bg-card/60 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3">
            <Button type="button" className="h-10">
              Continue with email
            </Button>
            <Button type="button" variant="outline" className="h-10">
              Continue with Google
            </Button>
            <Button asChild type="button" variant="ghost" className="h-10">
              <Link to="../">Back</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

