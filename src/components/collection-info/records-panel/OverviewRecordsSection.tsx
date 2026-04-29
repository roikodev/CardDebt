import { SkeletonMuted } from "@/components/collection-info/records-panel/shared"
import type { OverviewCollectionRow } from "@/components/collection-info/types"

type Props = {
  loading: boolean
  overviewRows: OverviewCollectionRow[]
}

export function OverviewRecordsSection({ loading, overviewRows }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-background/40 p-3">
            <SkeletonMuted className="h-4 w-16" />
            <div className="mt-2">
              <SkeletonMuted className="h-5 w-20" />
            </div>
            <div className="mt-2">
              <SkeletonMuted className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!overviewRows.length) return <p className="text-sm text-muted-foreground">No collection items found.</p>

  const sortedRows = [...overviewRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const grouped = {
    Available: sortedRows.filter((r) => !r.derived && !r.grading),
    Grading: sortedRows.filter((r) => !r.derived && r.grading),
    Derived: sortedRows.filter((r) => r.derived),
  }
  const statusClassByName: Record<keyof typeof grouped, string> = {
    Available: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
    Grading: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
    Derived: "bg-blue-500/15 text-blue-700 dark:text-blue-200",
  }

  return (
    <div className="space-y-4">
      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((status) => {
        const rows = grouped[status]
        if (!rows.length) return null

        return (
          <div key={status}>
            <p className="mb-2 text-sm font-medium">
              {status} ({rows.length})
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((row, idx) => (
                <div key={row.id} className="rounded-xl border bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Item #{idx + 1}</p>
                  <p className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusClassByName[status]}`}>
                    {status}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
