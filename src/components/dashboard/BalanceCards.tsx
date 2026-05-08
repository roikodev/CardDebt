import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown, TrendingUp, Wallet } from "lucide-react"

import { formatHKD } from "./utils"
import { SkeletonMuted } from "@/components/collection-info/records-panel/shared"

export function TotalBalanceCard({
  loading,
  error,
  totalBalanceHKD,
  animatedBalance,
}: {
  loading: boolean
  error: string | null
  totalBalanceHKD: number | null
  animatedBalance: number
}) {
  return (
    <Card className="h-full w-full overflow-hidden border-0 bg-gradient-to-br from-muted/30 via-background to-background shadow-sm ring-1 ring-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium">Total balance</CardTitle>
          <div className="rounded-md bg-background/70 p-2 ring-1 ring-border/60">
            <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-left">
        <p
          className={[
            "text-3xl font-semibold tracking-tight tabular-nums",
            loading ? "text-muted-foreground" : "",
            typeof totalBalanceHKD === "number" && totalBalanceHKD > 0
              ? "text-emerald-600"
              : typeof totalBalanceHKD === "number"
                ? "text-red-600"
                : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {error ? "—" : formatHKD(animatedBalance)}
        </p>
      </CardContent>
    </Card>
  )
}

export function BalanceChangeCard({
  loading,
  error,
  totalBalanceHKD,
  totalBalanceAgoHKD,
  compareLabel,
  notAvailable,
  range,
  onRangeChange,
}: {
  loading: boolean
  error: string | null
  totalBalanceHKD: number | null
  totalBalanceAgoHKD: number | null
  compareLabel: string
  notAvailable: boolean
  range: "all" | "365" | "180" | "90"
  onRangeChange: (v: "all" | "365" | "180" | "90") => void
}) {
  return (
    <Card className="h-full w-full overflow-hidden border-0 bg-gradient-to-br from-muted/20 via-background to-background shadow-sm ring-1 ring-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Change vs {compareLabel} ago</CardTitle>
        <div className="mt-2 flex w-full divide-x divide-border/60 overflow-hidden rounded-lg border bg-background/60">
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
      </CardHeader>
      <CardContent className="text-left">
        {notAvailable ? (
          <p className="text-sm text-muted-foreground">Not Available</p>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            <SkeletonMuted className="h-4 w-48" />
            <SkeletonMuted className="h-7 w-40" />
          </div>
        ) : error ? (
          <div className="space-y-2">
            <SkeletonMuted className="h-4 w-56" />
            <SkeletonMuted className="h-7 w-44" />
          </div>
        ) : notAvailable ? null : typeof totalBalanceHKD === "number" &&
          typeof totalBalanceAgoHKD === "number" ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              {formatHKD(totalBalanceAgoHKD)} → {formatHKD(totalBalanceHKD)}
            </p>
            {(() => {
              const delta = totalBalanceHKD - totalBalanceAgoHKD
              const pct =
                totalBalanceAgoHKD === 0
                  ? null
                  : (delta / Math.abs(totalBalanceAgoHKD)) * 100
              const up = delta >= 0
              return (
                <p
                  className={[
                    "inline-flex items-center gap-2 text-xl font-semibold tracking-tight tabular-nums",
                    up ? "text-emerald-600" : "text-red-600",
                  ].join(" ")}
                >
                  {up ? (
                    <TrendingUp className="size-5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="size-5" aria-hidden="true" />
                  )}
                  {formatHKD(delta)}
                  {pct === null ? null : (
                    <span className="text-sm font-medium opacity-80">
                      ({pct.toFixed(1)}%)
                    </span>
                  )}
                </p>
              )
            })()}
          </div>
        ) : (
          <div className="space-y-2">
            <SkeletonMuted className="h-4 w-56" />
            <SkeletonMuted className="h-7 w-44" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

