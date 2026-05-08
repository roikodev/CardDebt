import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { formatHKD } from "./utils"
import type { RoiRow } from "./types"

export function RoiSection({
  roiError,
  roiLoading,
  range,
  onRangeChange,
  roiSort,
  setRoiSort,
  roiSortApplied,
  roiRawTop,
  roiGradedTop,
  roiExpandedKey,
  setRoiExpandedKey,
}: {
  roiError: string | null
  roiLoading: boolean
  range: "all" | "365" | "180" | "90"
  onRangeChange: (v: "all" | "365" | "180" | "90") => void
  roiSort: "roi" | "profit"
  setRoiSort: (v: "roi" | "profit") => void
  roiSortApplied: "roi" | "profit"
  roiRawTop: RoiRow[]
  roiGradedTop: RoiRow[]
  roiExpandedKey: string | null
  setRoiExpandedKey: (v: string | null | ((cur: string | null) => string | null)) => void
}) {
  return (
    <section className="col-span-12">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-muted/20 via-background to-background shadow-sm ring-1 ring-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Top Ranking of Return on Investment (ROI)
          </CardTitle>
          <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
            <div className="flex w-full divide-x divide-border/60 overflow-hidden rounded-lg border bg-background/60 sm:w-1/2">
              {(
                [
                  ["all", "All Time"],
                  ["365", "1y"],
                  ["180", "6m"],
                  ["90", "3m"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => onRangeChange(k)}
                  className={[
                    "flex-1 cursor-pointer whitespace-nowrap px-3 py-2 text-xs font-medium transition",
                    range === k
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex w-full divide-x divide-border/60 overflow-hidden rounded-lg border bg-background/60 sm:w-1/2">
              {(
                [
                  ["profit", "By Profit"],
                  ["roi", "By Percentage"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRoiSort(k)}
                  className={[
                    "flex-1 cursor-pointer whitespace-nowrap px-3 py-2 text-xs font-medium transition",
                    roiSort === k
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {roiError ? <p className="text-sm text-destructive">{roiError}</p> : null}

          <div className="mt-2 max-h-[22rem] overflow-hidden rounded-xl border bg-card">
            <div className="grid grid-cols-[28px_52px_minmax(0,1fr)_84px] items-center gap-3 border-b bg-muted/20 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[28px_52px_minmax(0,1fr)_96px_84px]">
              <div className="text-center">#</div>
              <div> </div>
              <div>Item</div>
              <div className="hidden sm:block">Type</div>
              <div className="text-right">{roiSortApplied === "profit" ? "Profit" : "ROI"}</div>
            </div>

            <div className="divide-y overflow-y-auto">
              {(() => {
                const items = roiLoading
                  ? Array.from({ length: 5 }).map((_, i) => ({
                      key: `sk-${i}`,
                      loading: true,
                      rank: i + 1,
                    }))
                  : [...roiRawTop, ...roiGradedTop]
                      .sort((a, b) => {
                        if (roiSortApplied === "profit") {
                          return (b.total_profit - a.total_profit) || (b.roi - a.roi)
                        }
                        return (b.roi - a.roi) || (b.total_profit - a.total_profit)
                      })
                      .slice(0, 10)
                      .map((r, i) => ({
                        key: `${r.collection_item_id}-${r.graded}`,
                        row: r,
                        rank: i + 1,
                      }))

                return items.map((x) =>
                  (x as any).loading ? (
                    <div
                      key={(x as any).key}
                      className="grid grid-cols-[28px_52px_minmax(0,1fr)_84px] items-center gap-3 px-3 py-3 sm:grid-cols-[28px_52px_minmax(0,1fr)_96px_84px]"
                    >
                      <div className="text-center text-xs font-semibold text-muted-foreground tabular-nums">
                        {(x as any).rank}
                      </div>
                      <div className="h-10 w-10 animate-pulse rounded-lg bg-muted/40" />
                      <div className="min-w-0">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-muted/40" />
                        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted/30" />
                      </div>
                      <div className="hidden sm:block">
                        <div className="h-3 w-16 animate-pulse rounded bg-muted/30" />
                      </div>
                      <div className="ml-auto h-5 w-16 animate-pulse rounded bg-muted/40" />
                    </div>
                  ) : (() => {
                      const k = (x as any).key as string
                      const open = roiExpandedKey === k
                      const row = (x as any).row as RoiRow
                      return (
                        <div key={k}>
                          <button
                            type="button"
                            onClick={() =>
                              setRoiExpandedKey((cur) => (cur === k ? null : k))
                            }
                            className="w-full cursor-pointer text-left"
                          >
                            <div className="grid grid-cols-[28px_52px_minmax(0,1fr)_84px] items-stretch gap-3 px-3 py-3 hover:bg-muted/20 sm:grid-cols-[28px_52px_minmax(0,1fr)_96px_84px]">
                              <div
                                className={[
                                  "col-span-2 -my-3 -ml-3 flex items-stretch gap-3 py-3 pl-3 pr-1",
                                  (x as any).rank === 1
                                    ? "bg-gradient-to-r from-amber-300/90 via-amber-100/25 to-transparent"
                                    : (x as any).rank === 2
                                      ? "bg-gradient-to-r from-slate-200/80 to-transparent"
                                      : (x as any).rank === 3
                                        ? "bg-gradient-to-r from-orange-200/80 to-transparent"
                                        : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                <div className="flex items-center">
                                  <div
                                    className={[
                                      "w-[28px] text-center text-xs font-semibold tabular-nums",
                                      (x as any).rank <= 3
                                        ? "text-foreground"
                                        : "text-muted-foreground",
                                    ].join(" ")}
                                  >
                                    {(x as any).rank}
                                  </div>
                                </div>
                                <div className="flex items-center">
                                  <div className="h-10 w-10 overflow-hidden rounded-lg border bg-muted/30">
                                    {row.image_url ? (
                                      <img
                                        src={row.image_url}
                                        alt={row.name}
                                        className="h-full w-full object-cover object-left-top"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="h-full w-full bg-muted/40" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{row.name}</p>
                                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                  <p className="line-clamp-1">{row.game_title || "—"}</p>
                                  <p className="line-clamp-1">{row.card_no || "—"}</p>
                                </div>
                                <div className="mt-1 sm:hidden">
                                  <span
                                    className={[
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                      row.graded
                                        ? "border-sky-200 bg-sky-50 text-sky-700"
                                        : "border-zinc-200 bg-zinc-50 text-zinc-700",
                                    ].join(" ")}
                                  >
                                    {row.graded ? "Graded" : "Raw"}
                                  </span>
                                </div>
                              </div>

                              <div className="hidden sm:block">
                                <p className="text-xs text-muted-foreground">
                                  {row.graded ? "Graded" : "Raw"}
                                </p>
                              </div>

                              <div
                                className={[
                                  "text-right text-sm font-semibold tabular-nums",
                                  roiSortApplied === "profit"
                                    ? row.total_profit >= 0
                                      ? "text-emerald-600"
                                      : "text-red-600"
                                    : row.roi >= 0
                                      ? "text-emerald-600"
                                      : "text-red-600",
                                ].join(" ")}
                              >
                                {roiSortApplied === "profit"
                                  ? formatHKD(row.total_profit)
                                  : `${(row.roi * 100).toFixed(1)}%`}
                              </div>
                            </div>
                          </button>

                          <div
                            className={[
                              "overflow-hidden transition-all duration-200",
                              open
                                ? "max-h-80 opacity-100 translate-y-0"
                                : "max-h-0 opacity-0 -translate-y-1 pointer-events-none",
                            ].join(" ")}
                          >
                            <div className="px-3 pt-3 pb-3">
                              <div className="rounded-lg border bg-muted/10 p-3">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-baseline justify-between gap-3">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      ROI
                                    </p>
                                    <p
                                      className={[
                                        "text-base font-semibold tabular-nums",
                                        row.roi >= 0 ? "text-emerald-600" : "text-red-600",
                                      ].join(" ")}
                                    >
                                      {(row.roi * 100).toFixed(2)}%
                                    </p>
                                  </div>

                                  <div className="h-px bg-border/60" />

                                  <div className="grid grid-cols-1 gap-1 text-sm tabular-nums sm:grid-cols-2 sm:gap-x-6">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-xs font-medium text-muted-foreground">
                                        Revenue
                                      </p>
                                      <p className="font-medium text-foreground">
                                        {formatHKD(row.total_revenue)}
                                      </p>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-xs font-medium text-muted-foreground">
                                        Total cost
                                      </p>
                                      <p className="font-medium text-foreground">
                                        {formatHKD(row.total_cost)}
                                      </p>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-xs font-medium text-muted-foreground">
                                        Profit
                                      </p>
                                      <p
                                        className={[
                                          "font-medium",
                                          row.total_profit >= 0
                                            ? "text-emerald-600"
                                            : "text-red-600",
                                        ].join(" ")}
                                      >
                                        {formatHKD(row.total_profit)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="mt-1 rounded-md border bg-background/40 p-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Cost breakdown
                                    </p>
                                    <div className="mt-1 grid grid-cols-1 gap-1 tabular-nums sm:grid-cols-2 sm:gap-x-6">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs text-muted-foreground">Buy</p>
                                        <p className="text-xs font-medium text-foreground">
                                          {formatHKD(row.buy_cost)}
                                        </p>
                                      </div>
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs text-muted-foreground">Misc</p>
                                        <p className="text-xs font-medium text-foreground">
                                          {formatHKD(row.misc_cost)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()
                )
              })()}

              {!roiLoading && roiRawTop.length === 0 && roiGradedTop.length === 0 ? (
                <div className="px-3 py-6 text-sm text-muted-foreground">
                  No ROI data in the selected range.
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

