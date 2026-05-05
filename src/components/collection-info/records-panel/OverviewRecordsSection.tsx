import { SkeletonMuted } from "@/components/collection-info/records-panel/shared"
import type { OverviewCollectionRow } from "@/components/collection-info/types"

type Props = {
  loading: boolean
  overviewRows: OverviewCollectionRow[]
}

export function OverviewRecordsSection({ loading, overviewRows }: Props) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="inline-flex min-w-0 items-center gap-2 rounded-full border bg-background/40 px-3 py-2"
          >
            <SkeletonMuted className="h-3 w-16" />
            <SkeletonMuted className="h-3 w-6" />
          </div>
        ))}
      </div>
    )
  }

  if (!overviewRows.length) return <p className="text-sm text-muted-foreground">No collection items found.</p>

  return <p className="text-sm text-muted-foreground">Overview is shown in the card info panel.</p>
}
