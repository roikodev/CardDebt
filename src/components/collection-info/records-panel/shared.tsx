import type { TFunction } from "i18next"

import type {
  BuyEntry,
  DerivedRecordRow,
  GradingRecordRow,
  OverviewCollectionRow,
} from "@/components/collection-info/types"
import { cn } from "@/lib/utils"

export type RecordsView = "purchase" | "derived" | "grading"

export function formatMiscCostTypeLabel(t: TFunction, type: string): string {
  switch (type) {
    case "Grading":
      return t("dialogs.costType.grading")
    case "Postal":
      return t("dialogs.costType.postal")
    case "Other":
      return t("dialogs.costType.other")
    default:
      return type
  }
}

export function formatCostLinesSummary(
  t: TFunction,
  lines: Array<{ type: string; price: unknown }>,
  formatMoneyHKD: (n: number) => string,
): string {
  return lines
    .map(
      (c) =>
        `${formatMiscCostTypeLabel(t, c.type)} ${formatMoneyHKD(Number(c.price) || 0)}`,
    )
    .join(" · ")
}

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

export function getPanelMeta(
  t: TFunction,
  args: {
    recordsView: RecordsView
    loading: boolean
    derivedLoading: boolean
    buyEntries: BuyEntry[]
    derivedRecords: DerivedRecordRow[]
    gradingRecords: GradingRecordRow[]
    overviewRows: OverviewCollectionRow[]
  },
) {
  const { recordsView, loading, derivedLoading, buyEntries, derivedRecords, gradingRecords } = args

  if (recordsView === "purchase") {
    const count = buyEntries.length
    return {
      title: t("recordsPanel.purchaseTitle"),
      loading,
      count,
      recordsCountLabel: t("recordsPanel.recordsCount", { count }),
    }
  }
  if (recordsView === "derived") {
    const count = derivedRecords.length
    return {
      title: t("recordsPanel.derivedTitle"),
      loading: derivedLoading,
      count,
      recordsCountLabel: t("recordsPanel.recordsCount", { count }),
    }
  }
  const count = gradingRecords.length
  return {
    title: t("recordsPanel.gradingTitle"),
    loading,
    count,
    recordsCountLabel: t("recordsPanel.recordsCount", { count }),
  }
}
