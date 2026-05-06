import { DerivedRecordsSection } from "@/components/collection-info/records-panel/DerivedRecordsSection"
import { GradingRecordsSection } from "@/components/collection-info/records-panel/GradingRecordsSection"
import { PurchaseRecordsSection } from "@/components/collection-info/records-panel/PurchaseRecordsSection"
import { RecordsPanelHeader } from "@/components/collection-info/records-panel/RecordsPanelHeader"
import type { RecordsView } from "@/components/collection-info/records-panel/shared"
import type {
  BuyEntry,
  DerivedRecordRow,
  GradingRecordRow,
  OverviewCollectionRow,
} from "@/components/collection-info/types"

type Props = {
  recordsView: RecordsView
  setRecordsView: (view: RecordsView) => void
  hideGradingView?: boolean
  loading: boolean
  buyEntries: BuyEntry[]
  derivedLoading: boolean
  derivedError: string | null
  derivedRecords: DerivedRecordRow[]
  derivedImageUrls: Record<string, string>
  gradingRecords: GradingRecordRow[]
  overviewRows: OverviewCollectionRow[]
  sourceImageUrl: string | null
  sourceTitle: string
  formatMoneyHKD: (n: number) => string
  onRefresh?: () => void
}

export function RecordsPanel(props: Props) {
  const gradingAllowed = !props.hideGradingView
  const effectiveView = gradingAllowed && props.recordsView === "grading" ? "grading" : props.recordsView

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-card/40 p-3 text-left sm:p-4">
      <RecordsPanelHeader
        recordsView={effectiveView}
        setRecordsView={props.setRecordsView}
        loading={props.loading}
        derivedLoading={props.derivedLoading}
        buyEntries={props.buyEntries}
        derivedRecords={props.derivedRecords}
        gradingRecords={props.gradingRecords}
        overviewRows={props.overviewRows}
        hideGradingView={props.hideGradingView}
      />

      {gradingAllowed && effectiveView === "grading" ? (
        <GradingRecordsSection
          loading={props.loading}
          gradingRecords={props.gradingRecords}
          sourceImageUrl={props.sourceImageUrl}
          sourceTitle={props.sourceTitle}
          formatMoneyHKD={props.formatMoneyHKD}
          onUpdated={props.onRefresh}
        />
      ) : props.recordsView === "purchase" ? (
        <PurchaseRecordsSection
          loading={props.loading}
          buyEntries={props.buyEntries}
          formatMoneyHKD={props.formatMoneyHKD}
          onUpdated={props.onRefresh}
        />
      ) : (
        <DerivedRecordsSection
          derivedError={props.derivedError}
          derivedLoading={props.derivedLoading}
          derivedRecords={props.derivedRecords}
          derivedImageUrls={props.derivedImageUrls}
          formatMoneyHKD={props.formatMoneyHKD}
          onUpdated={props.onRefresh}
        />
      )}
    </section>
  )
}
