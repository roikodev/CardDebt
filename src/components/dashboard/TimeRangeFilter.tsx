export type DashboardTimeRange = "all" | "365" | "180" | "90"

export function TimeRangeFilter({
  value,
  onChange,
}: {
  value: DashboardTimeRange
  onChange: (v: DashboardTimeRange) => void
}) {
  return (
    <section className="col-span-12">
      <div className="flex w-full divide-x divide-border/60 overflow-hidden rounded-lg border bg-background/60">
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
            onClick={() => onChange(k)}
            className={[
              "flex-1 cursor-pointer whitespace-nowrap px-3 py-2 text-xs font-medium transition",
              value === k
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}

