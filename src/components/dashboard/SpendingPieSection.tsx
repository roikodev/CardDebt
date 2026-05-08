import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { formatHKD } from "./utils"

export function SpendingPieSection({
  range,
  onRangeChange,
  loading,
  error,
  buyTotal,
  sellTotal,
  miscTotal,
}: {
  range: "all" | "365" | "180" | "90"
  onRangeChange: (v: "all" | "365" | "180" | "90") => void
  loading: boolean
  error: string | null
  buyTotal: number
  sellTotal: number
  miscTotal: number
}) {
  const buy = Math.max(0, Number(buyTotal) || 0)
  const sell = Math.max(0, Number(sellTotal) || 0)
  const misc = Math.max(0, Number(miscTotal) || 0)
  const total = buy + sell + misc

  const buyPct = total > 0 ? (buy / total) * 100 : 0
  const sellPct = total > 0 ? (sell / total) * 100 : 0
  const miscPct = total > 0 ? (misc / total) * 100 : 0

  const c1 = "#fb7185" // rose-400 (Buy)
  const c2 = "#34d399" // emerald-400 (Sell)
  const c3 = "#fbbf24" // amber-400 (Misc)
  const pieData = [
    { name: "Buy", value: buy, color: c1, pct: buyPct },
    { name: "Sell", value: sell, color: c2, pct: sellPct },
    { name: "Misc", value: misc, color: c3, pct: miscPct },
  ].filter((d) => d.value > 0)

  return (
    <section className="col-span-12 md:col-span-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-muted/20 via-background to-background shadow-sm ring-1 ring-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Spending / Gaining breakdown</CardTitle>
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
          </div>
        </CardHeader>

        <CardContent>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <div className="flex items-center justify-center">
              <div className="relative size-40">
                {total <= 0 ? (
                  <div
                    className={[
                      "size-40 rounded-full ring-1 ring-border/60",
                      loading ? "animate-pulse opacity-80" : "",
                    ].join(" ")}
                    style={{
                      background:
                        "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.10), rgba(0,0,0,0.06))",
                    }}
                    aria-label="Pie chart"
                  />
                ) : (
                  <div
                    className={[
                      "size-40 rounded-full ring-1 ring-border/60",
                      loading ? "animate-pulse opacity-80" : "",
                    ].join(" ")}
                    aria-label="Pie chart"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          cursor={{ fill: "rgba(0,0,0,0.04)" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const p = payload[0] as any
                            const name = String(p?.name ?? "")
                            const value = Number(p?.value ?? 0) || 0
                            const pct = total > 0 ? (value / total) * 100 : 0
                            const color = String(p?.payload?.color ?? "#999")

                            return (
                              <div className="rounded-lg border bg-background/95 p-2 shadow-md backdrop-blur">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block size-2.5 rounded-full"
                                    style={{ backgroundColor: color }}
                                    aria-hidden="true"
                                  />
                                  <p className="text-xs font-medium text-foreground">{name}</p>
                                </div>
                                <div className="mt-1 flex items-baseline justify-between gap-4 tabular-nums">
                                  <p className="text-sm font-semibold text-foreground">
                                    {formatHKD(value)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {pct.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius="90%"
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                          isAnimationActive={!loading}
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <LegendRow
                label="Buy"
                color={c1}
                amount={buy}
                pct={buyPct}
              />
              <LegendRow
                label="Sell"
                color={c2}
                amount={sell}
                pct={sellPct}
              />
              <LegendRow
                label="Misc"
                color={c3}
                amount={misc}
                pct={miscPct}
              />
              {total <= 0 && !loading ? (
                <p className="text-xs text-muted-foreground">No data in this range.</p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function LegendRow({
  label,
  color,
  amount,
  pct,
}: {
  label: string
  color: string
  amount: number
  pct: number
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="inline-block size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <p className="truncate font-medium">{label}</p>
      </div>
      <div className="flex items-baseline gap-2 tabular-nums">
        <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
        <p className="font-semibold">{formatHKD(amount)}</p>
      </div>
    </div>
  )
}

