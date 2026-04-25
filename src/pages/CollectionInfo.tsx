import { Button } from "@/components/ui/button"
import { useNavigate } from "@tanstack/react-router"
import { Route } from "@/routes/user/my-collection/$collection_item_id"
import { ArrowLeft } from "lucide-react"

export function CollectionInfo() {
  const navigate = useNavigate()
  const { collection_item_id } = Route.useParams()
  const search = Route.useSearch()

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            className="gap-2 px-2"
            onClick={() => navigate({ to: "/user/my-collection" })}
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
            My Collection
          </Button>
        </div>

        <div className="rounded-2xl border bg-card/40 p-4 text-left">
          <h1 className="text-xl font-semibold tracking-tight">Collection Info</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            collection_item_id: <span className="font-mono">{collection_item_id}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            graded: <span className="font-mono">{String(search.graded ?? false)}</span>
          </p>
        </div>
      </div>
    </main>
  )
}

