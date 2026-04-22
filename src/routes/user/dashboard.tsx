import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/user/dashboard")({
  component: () => (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 py-14">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Logged in. Next: build your real dashboard.
        </p>
      </div>
    </main>
  ),
})

