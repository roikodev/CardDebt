import type {
  BuyEntry,
  DerivedRecordRow,
  GradingRecordRow,
  OverviewCollectionRow,
} from "@/components/collection-info/types"
import { cn } from "@/lib/utils"

export type RecordsView = "purchase" | "derived" | "grading"

/** Shimmer block: stays within flex/grid parents (min-w-0, max-w-full, overflow hidden). */
export function SkeletonMuted({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "min-h-[0.5rem] min-w-0 max-w-full shrink overflow-hidden rounded-md bg-muted/50 animate-pulse",
        className
      )}
    />
  )
}

export function getPanelMeta(args: {
  recordsView: RecordsView
  loading: boolean
  derivedLoading: boolean
  buyEntries: BuyEntry[]
  derivedRecords: DerivedRecordRow[]
  gradingRecords: GradingRecordRow[]
  overviewRows: OverviewCollectionRow[]
}) {
  const { recordsView, loading, derivedLoading, buyEntries, derivedRecords, gradingRecords } = args

  if (recordsView === "purchase") {
    return { title: "Purchase records", loading, count: buyEntries.length, label: "record" }
  }
  if (recordsView === "derived") {
    return { title: "Derived records", loading: derivedLoading, count: derivedRecords.length, label: "record" }
  }
  return { title: "Grading records", loading, count: gradingRecords.length, label: "record" }
}
