import { Button } from "@/components/ui/button"
import { SkeletonMuted, type RecordsView, getPanelMeta } from "@/components/collection-info/records-panel/shared"
import { cn } from "@/lib/utils"
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
    <div className="mb-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 shrink">
        <h2 className="text-base font-semibold">{meta.title}</h2>
        {meta.loading ? (
          <SkeletonMuted className="mt-1 h-4 w-full max-w-24" />
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {meta.count} {meta.label}
            {meta.count === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <div
        className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2"
        role="group"
        aria-label="Record views"
      >
        <Button
          type="button"
          size="sm"
          variant={props.recordsView === "purchase" ? "default" : "outline"}
          className={cn("min-w-0 px-2 text-xs sm:px-3 sm:text-sm")}
          onClick={() => props.setRecordsView("purchase")}
        >
          Purchase
        </Button>
        <Button
          type="button"
          size="sm"
          variant={props.recordsView === "derived" ? "default" : "outline"}
          className={cn("min-w-0 px-2 text-xs sm:px-3 sm:text-sm")}
          onClick={() => props.setRecordsView("derived")}
        >
          Derived
        </Button>
        <Button
          type="button"
          size="sm"
          variant={props.recordsView === "grading" ? "default" : "outline"}
          className={cn("min-w-0 truncate px-2 text-xs sm:px-3 sm:text-sm")}
          onClick={() => props.setRecordsView("grading")}
        >
          Grading ({props.gradingRecords.length})
        </Button>
      </div>
    </div>
  )
}
