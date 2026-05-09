import type { ActivityTrendPoint } from "@/components/dashboard/activityTrend"
import type { DashboardTimeRange } from "@/components/dashboard/TimeRangeFilter"
import { formatHKD } from "./utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const BUY = "#fb7185"
const SELL = "#34d399"
const MISC = "#fbbf24"

/** Theme tokens are oklch — use `var()` directly, not `hsl(var(...))`. */
const axisMuted = "var(--muted-foreground)"
const axisBorder = "var(--border)"

function compactAxisHKD(n: number): string {
  if (!Number.isFinite(n)) return "$0"
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `$${(n / 1000).toFixed(1)}k`
  if (abs >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}

export function ActivityTrendSection({
  range,
  onRangeChange,
  loading,
  error,
  points,
}: {
  range: DashboardTimeRange
  onRangeChange: (v: DashboardTimeRange) => void
  loading: boolean
  error: string | null
  points: ActivityTrendPoint[]
}) {
  const showSkeleton = loading && points.length === 0

  return (
    <section className="col-span-12 md:col-span-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-muted/20 via-background to-background shadow-sm ring-1 ring-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Spending & gains over time</CardTitle>
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

        <CardContent>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {showSkeleton ? (
            <div className="mt-2 h-[280px] w-full animate-pulse rounded-lg bg-muted/25" />
          ) : (
          <div
            className={[
              "mt-2 h-[280px] w-full min-h-0",
              loading ? "opacity-70" : "",
            ].join(" ")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid stroke={axisBorder} strokeOpacity={0.45} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: axisMuted }}
                  tickLine={{ stroke: axisBorder }}
                  axisLine={{ stroke: axisBorder }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisMuted }}
                  tickLine={{ stroke: axisBorder }}
                  axisLine={{ stroke: axisBorder }}
                  tickFormatter={(v) => compactAxisHKD(Number(v))}
                  width={52}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-lg border bg-background/95 p-3 shadow-md backdrop-blur">
                        <p className="mb-2 text-xs font-medium text-foreground">{label}</p>
                        <div className="space-y-1.5">
                          {payload.map((p) => (
                            <div
                              key={String(p.dataKey)}
                              className="flex items-center justify-between gap-6 text-xs tabular-nums"
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block size-2 rounded-full"
                                  style={{ backgroundColor: p.color }}
                                  aria-hidden
                                />
                                <span className="text-muted-foreground">{p.name}</span>
                              </span>
                              <span className="font-semibold text-foreground">
                                {typeof p.value === "number"
                                  ? formatHKD(p.value)
                                  : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                />
                <Line
                  type="monotone"
                  dataKey="buyCum"
                  name="Buy"
                  stroke={BUY}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={!loading}
                />
                <Line
                  type="monotone"
                  dataKey="sellCum"
                  name="Sell"
                  stroke={SELL}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={!loading}
                />
                <Line
                  type="monotone"
                  dataKey="miscCum"
                  name="Misc"
                  stroke={MISC}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={!loading}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
