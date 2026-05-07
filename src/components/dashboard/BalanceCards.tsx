import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown, TrendingUp, Wallet } from "lucide-react"

import { formatHKD } from "./utils"

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
    <Card className="col-span-12 overflow-hidden border-0 bg-gradient-to-br from-muted/30 via-background to-background shadow-sm ring-1 ring-border/60">
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
  totalBalance30dAgoHKD,
}: {
  loading: boolean
  error: string | null
  totalBalanceHKD: number | null
  totalBalance30dAgoHKD: number | null
}) {
  return (
    <Card className="col-span-12 overflow-hidden border-0 bg-gradient-to-br from-muted/20 via-background to-background shadow-sm ring-1 ring-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Change vs 30 days ago</CardTitle>
      </CardHeader>
      <CardContent className="text-left">
        {loading || error ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : typeof totalBalanceHKD === "number" &&
          typeof totalBalance30dAgoHKD === "number" ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              {formatHKD(totalBalance30dAgoHKD)} → {formatHKD(totalBalanceHKD)}
            </p>
            {(() => {
              const delta = totalBalanceHKD - totalBalance30dAgoHKD
              const pct =
                totalBalance30dAgoHKD === 0
                  ? null
                  : (delta / Math.abs(totalBalance30dAgoHKD)) * 100
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
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </CardContent>
    </Card>
  )
}

