import type { ComponentProps } from "react"
import { useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTimeRangeOptions } from "@/hooks/useTimeRangeOptions"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { useTranslation } from "react-i18next"

import { formatHKD } from "./utils"

type Slice = { name: string; value: number; color: string }

type GameTitlePieVariant = "spending" | "gaining"

export function GameTitleSpendingPieSection({
  variant = "spending",
  range,
  onRangeChange,
  loading,
  error,
  slices,
}: {
  variant?: GameTitlePieVariant
  range: "all" | "365" | "180" | "90"
  onRangeChange: (v: "all" | "365" | "180" | "90") => void
  loading: boolean
  error: string | null
  slices: Slice[]
}) {
  const { t } = useTranslation()
  const timeOpts = useTimeRangeOptions()

  const copy = useMemo(() => {
    if (variant === "spending") {
      return {
        title: t("gameTitlePie.spendingTitle"),
        totalLabel: t("gameTitlePie.spendingTotal"),
        footnote: t("gameTitlePie.spendingFootnote"),
        empty: t("gameTitlePie.spendingEmpty"),
      }
    }
    return {
      title: t("gameTitlePie.gainingTitle"),
      totalLabel: t("gameTitlePie.gainingTotal"),
      footnote: t("gameTitlePie.gainingFootnote"),
      empty: t("gameTitlePie.gainingEmpty"),
    }
  }, [variant, t])

  const total = slices.reduce((sum, s) => sum + (Number(s.value) || 0), 0)

  return (
    <section className="col-span-12 md:col-span-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-muted/20 via-background to-background shadow-sm ring-1 ring-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{copy.title}</CardTitle>
          <div className="mt-2 flex w-full divide-x divide-border/60 overflow-hidden rounded-lg border bg-background/60">
            {timeOpts.map(([k, label]) => (
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

          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
            <div className="flex justify-center md:items-center md:justify-center">
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
                    aria-label={t("common.pieChart")}
                  />
                ) : (
                  <div
                    className={[
                      "size-40 rounded-full ring-1 ring-border/60",
                      loading ? "animate-pulse opacity-80" : "",
                    ].join(" ")}
                    aria-label={t("common.pieChart")}
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
                          data={slices}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius="90%"
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                          isAnimationActive={!loading}
                        >
                          {slices.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="max-h-40 min-w-0 space-y-2 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {slices.map((s) => (
                <LegendRow key={s.name} label={s.name} color={s.color} amount={s.value} total={total} />
              ))}
              {total <= 0 && !loading ? (
                <p className="text-xs text-muted-foreground">{copy.empty}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 border-t pt-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{copy.totalLabel}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{copy.footnote}</p>
              </div>
              <p
                className={[
                  "shrink-0 text-base font-semibold tabular-nums",
                  variant === "spending"
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600",
                  loading ? "animate-pulse opacity-80" : "",
                ].join(" ")}
              >
                {formatHKD(total)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export function GameTitleGainingPieSection(
  props: Omit<ComponentProps<typeof GameTitleSpendingPieSection>, "variant">
) {
  return <GameTitleSpendingPieSection {...props} variant="gaining" />
}

function LegendRow({
  label,
  color,
  amount,
  total,
}: {
  label: string
  color: string
  amount: number
  total: number
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0
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
