import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { DashboardTimeRange } from "@/components/dashboard/TimeRangeFilter"

export function useTimeRangeOptions(): readonly [DashboardTimeRange, string][] {
  const { t } = useTranslation()
  return useMemo(
    () =>
      [
        ["all", t("timeRange.all")],
        ["365", t("timeRange.y1")],
        ["180", t("timeRange.m6")],
        ["90", t("timeRange.m3")],
      ] as const,
    [t]
  )
}
