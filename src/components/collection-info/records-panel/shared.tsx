import type {
  BuyEntry,
  DerivedRecordRow,
  GradingRecordRow,
  OverviewCollectionRow,
} from "@/components/collection-info/types"

export type RecordsView = "overview" | "purchase" | "derived" | "grading"

export function SkeletonMuted({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted/50 ${className}`} />
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
  const { recordsView, loading, derivedLoading, buyEntries, derivedRecords, gradingRecords, overviewRows } = args

  if (recordsView === "overview") {
    return { title: "Overview", loading, count: overviewRows.length, label: "item" }
  }
  if (recordsView === "purchase") {
    return { title: "Purchase records", loading, count: buyEntries.length, label: "record" }
  }
  if (recordsView === "derived") {
    return { title: "Derived records", loading: derivedLoading, count: derivedRecords.length, label: "record" }
  }
  return { title: "Grading records", loading, count: gradingRecords.length, label: "record" }
}
