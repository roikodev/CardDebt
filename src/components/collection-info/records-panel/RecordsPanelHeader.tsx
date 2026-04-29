import { Button } from "@/components/ui/button"
import { SkeletonMuted, type RecordsView, getPanelMeta } from "@/components/collection-info/records-panel/shared"
import type {
  BuyEntry,
  DerivedRecordRow,
  GradingRecordRow,
  OverviewCollectionRow,
} from "@/components/collection-info/types"

type Props = {
  recordsView: RecordsView
  setRecordsView: (view: RecordsView) => void
  loading: boolean
  derivedLoading: boolean
  buyEntries: BuyEntry[]
  derivedRecords: DerivedRecordRow[]
  gradingRecords: GradingRecordRow[]
  overviewRows: OverviewCollectionRow[]
}

export function RecordsPanelHeader(props: Props) {
  const meta = getPanelMeta(props)

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{meta.title}</h2>
        {meta.loading ? (
          <SkeletonMuted className="mt-1 h-4 w-20" />
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {meta.count} {meta.label}
            {meta.count === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant={props.recordsView === "overview" ? "default" : "outline"} onClick={() => props.setRecordsView("overview")}>
          Overview
        </Button>
        <Button type="button" size="sm" variant={props.recordsView === "purchase" ? "default" : "outline"} onClick={() => props.setRecordsView("purchase")}>
          Purchase
        </Button>
        <Button type="button" size="sm" variant={props.recordsView === "derived" ? "default" : "outline"} onClick={() => props.setRecordsView("derived")}>
          Derived
        </Button>
        <Button type="button" size="sm" variant={props.recordsView === "grading" ? "default" : "outline"} onClick={() => props.setRecordsView("grading")}>
          Grading ({props.gradingRecords.length})
        </Button>
      </div>
    </div>
  )
}
