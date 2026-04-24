import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"

export function MyCollection() {
  const navigate = useNavigate()

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="sticky top-0 z-20 -mx-4 mb-4 flex items-center justify-start border-b bg-background/80 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            className="gap-2 px-2"
            onClick={() => navigate({ to: "/user/dashboard" })}
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
            Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Collection</CardTitle>
          </CardHeader>
          <CardContent className="text-left">
            <p className="text-sm text-muted-foreground">
              This page is ready. Next step: render your collection data here.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

