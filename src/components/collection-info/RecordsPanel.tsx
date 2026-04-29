import { Button } from "@/components/ui/button"
import type {
  BuyEntry,
  CollectionBase,
  DerivedRecordRow,
  GradingRecordRow,
} from "@/components/collection-info/types"
import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

function SkeletonMuted({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted/50 ${className}`} />
}

type Props = {
  recordsView: "purchase" | "derived" | "grading"
  setRecordsView: (view: "purchase" | "derived" | "grading") => void
  loading: boolean
  buyEntries: BuyEntry[]
  derivedLoading: boolean
  derivedError: string | null
  derivedRecords: DerivedRecordRow[]
  derivedImageUrls: Record<string, string>
  gradingRecords: GradingRecordRow[]
  sourceImageUrl: string | null
  sourceTitle: string
  formatMoneyHKD: (n: number) => string
}

export function RecordsPanel({
  recordsView,
  setRecordsView,
  loading,
  buyEntries,
  derivedLoading,
  derivedError,
  derivedRecords,
  derivedImageUrls,
  gradingRecords,
  sourceImageUrl,
  sourceTitle,
  formatMoneyHKD,
}: Props) {
  return (
    <section className="min-w-0 rounded-2xl border bg-card/40 p-4 text-left">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            {recordsView === "purchase"
              ? "Purchase records"
              : recordsView === "derived"
                ? "Derived records"
                : "Grading records"}
          </h2>
          {recordsView === "purchase" ? (
            loading ? (
              <SkeletonMuted className="mt-1 h-4 w-20" />
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {buyEntries.length} record{buyEntries.length === 1 ? "" : "s"}
              </p>
            )
          ) : recordsView === "derived" ? (
            derivedLoading ? (
              <SkeletonMuted className="mt-1 h-4 w-20" />
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {derivedRecords.length} record{derivedRecords.length === 1 ? "" : "s"}
              </p>
            )
          ) : loading ? (
            <SkeletonMuted className="mt-1 h-4 w-20" />
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {gradingRecords.length} record{gradingRecords.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={recordsView === "purchase" ? "default" : "outline"}
            onClick={() => setRecordsView("purchase")}
          >
            Purchase
          </Button>
          <Button
            type="button"
            size="sm"
            variant={recordsView === "derived" ? "default" : "outline"}
            onClick={() => setRecordsView("derived")}
          >
            Derived
          </Button>
          <Button
            type="button"
            size="sm"
            variant={recordsView === "grading" ? "default" : "outline"}
            onClick={() => setRecordsView("grading")}
          >
            Grading
          </Button>
        </div>
      </div>

      {recordsView === "grading" ? (
        loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-background/40 p-3">
                <SkeletonMuted className="h-4 w-40" />
                <div className="mt-2">
                  <SkeletonMuted className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : gradingRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">No grading records found.</p>
        ) : (
          <div className="space-y-2">
            {gradingRecords.map((r) => (
              <div key={r.id} className="rounded-xl border bg-background/40 p-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted/30">
                    {sourceImageUrl ? (
                      <img
                        src={sourceImageUrl}
                        alt={sourceTitle}
                        className="h-full w-full object-cover object-left-top"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full animate-pulse bg-muted/50" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{sourceTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sent at: {new Date(r.sent_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatMoneyHKD(r.costTotal)}</p>
                  </div>
                </div>
                {r.costLines.length ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.costLines
                      .map((c) => `${c.type} ${formatMoneyHKD(Number(c.price) || 0)}`)
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No cost entries.</p>
                )}
              </div>
            ))}
          </div>
        )
      ) : recordsView === "purchase" ? (
        loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-background/40 p-2">
                <div className="flex items-baseline justify-between gap-3">
                  <SkeletonMuted className="h-4 w-24" />
                  <SkeletonMuted className="h-4 w-20" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <SkeletonMuted className="h-3 w-10" />
                    <div className="mt-1">
                      <SkeletonMuted className="h-4 w-24" />
                    </div>
                  </div>
                  <div className="text-right">
                    <SkeletonMuted className="ml-auto h-3 w-8" />
                    <div className="mt-1">
                      <SkeletonMuted className="ml-auto h-4 w-10" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : buyEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purchase records found.</p>
        ) : (
          <>
            <div className="hidden grid-cols-[140px_1fr_90px_110px] gap-3 border-b pb-2 text-xs font-medium text-muted-foreground lg:grid">
              <div>Date</div>
              <div>Price (per 1)</div>
              <div>Qty</div>
              <div className="text-right">Total</div>
            </div>

            <div className="mt-2 space-y-2">
              {buyEntries.map((b) => {
                const total = (Number(b.price_hkd) || 0) * (Number(b.quantity) || 0)
                return (
                  <div key={b.id} className="rounded-xl border bg-background/40 p-2">
                    <div className="grid gap-2 lg:hidden">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium">{b.purchase_date}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="text-xs">Price</span>
                        <div className="mt-0.5 flex items-baseline justify-between gap-3">
                          <div className="min-w-0 text-foreground">
                            {formatMoneyHKD(Number(b.price_hkd))}{" "}
                            <span className="text-muted-foreground">×</span> {b.quantity}
                          </div>
                          <div className="shrink-0 text-foreground">{formatMoneyHKD(total)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="hidden grid-cols-[140px_1fr_90px_110px] items-center gap-3 lg:grid">
                      <div className="text-sm">{b.purchase_date}</div>
                      <div className="text-sm">{formatMoneyHKD(Number(b.price_hkd))}</div>
                      <div className="text-sm">{b.quantity}</div>
                      <div className="text-right text-sm font-semibold">{formatMoneyHKD(total)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      ) : derivedError ? (
        <p className="text-sm text-destructive">{derivedError}</p>
      ) : derivedLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border bg-background/40 p-3">
              <SkeletonMuted className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <SkeletonMuted className="h-4 w-40" />
                <div className="mt-2">
                  <SkeletonMuted className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : derivedRecords.length === 0 ? (
        <p className="text-sm text-muted-foreground">No derived records found.</p>
      ) : (
        <div className="space-y-3">
          {(() => {
            const metaLine = (base: CollectionBase | null | undefined) =>
              [base?.game_title, base?.card_no].filter(Boolean).join(" · ") || "—"

            const sideLink = (
              ucId: string | undefined,
              graded: boolean,
              baseName: string,
              img: string | undefined,
              label: string,
              subtitle: string
            ) =>
              ucId ? (
                <Link
                  to="/user/my-collection/$collection_item_id"
                  params={{ collection_item_id: ucId }}
                  search={{ graded }}
                  className="flex min-w-0 flex-1 items-start gap-2 rounded-md p-1.5 transition hover:bg-muted/25"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted/30">
                    {img ? (
                      <img
                        src={img}
                        alt={baseName}
                        className="h-full w-full object-cover object-left-top"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full animate-pulse bg-muted/50" />
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {label}
                      </p>
                      <span
                        className={
                          graded
                            ? "rounded-md bg-emerald-500/15 px-1.5 py-0 text-[10px] font-medium text-emerald-800 dark:text-emerald-200"
                            : "rounded-md bg-muted/80 px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                        }
                      >
                        {graded ? "Graded" : "Ungraded"}
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium">{baseName}</p>
                    <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                  </div>
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-start gap-2 rounded-md p-1.5 opacity-70">
                  <div className="h-10 w-10 shrink-0 rounded-md bg-muted/50" />
                  <div className="min-w-0 text-left">
                    <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                    <p className="text-sm text-muted-foreground">—</p>
                  </div>
                </div>
              )

            const groups = derivedRecords.reduce((acc, r) => {
              const key = r.from_user_collection_id
              if (!acc.has(key)) acc.set(key, [])
              acc.get(key)!.push(r)
              return acc
            }, new Map<string, DerivedRecordRow[]>())

            const orderedGroups = Array.from(groups.entries())
              .map(([fromId, rows]) => {
                const latest = rows.reduce(
                  (max, r) =>
                    new Date(r.created_at).getTime() > max
                      ? new Date(r.created_at).getTime()
                      : max,
                  0
                )
                return { fromId, rows, latest }
              })
              .sort((a, b) => b.latest - a.latest)

            return orderedGroups.map(({ fromId, rows }) => {
              const first = rows[0]
              const fromBase = first.from_user_collection?.collection_base
              const fromName = fromBase?.name ?? "Source"
              const imgFrom = derivedImageUrls[`from:${fromId}`]
              const fromItemId = first.from_user_collection?.collection_item_id
              const fromG = first.from_user_collection?.graded ?? false

              const derivedRows = [...rows].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
              const sourceDerivedTotal = derivedRows.reduce(
                (sum, r) => sum + (Number(r.costTotal) || 0),
                0
              )

              return (
                <div key={`src-${fromId}`} className="rounded-xl border bg-background/30 p-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {sideLink(
                        fromItemId,
                        fromG,
                        fromName,
                        imgFrom,
                        "Source",
                        metaLine(fromBase)
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">Total deriving cost</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoneyHKD(sourceDerivedTotal)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                    {derivedRows.map((dr) => {
                      const toBase = dr.to_user_collection?.collection_base
                      const toName = toBase?.name ?? "Derived item"
                      const imgTo = derivedImageUrls[`to:${dr.to_user_collection_id}`]
                      const toItemId = dr.to_user_collection?.collection_item_id
                      const toG = dr.to_user_collection?.graded ?? false

                      return (
                        <div key={dr.id} className="rounded-md p-1.5">
                          <div className="flex items-start gap-2">
                            <div className="pt-2 text-muted-foreground">
                              <ArrowRight className="size-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              {sideLink(
                                toItemId,
                                toG,
                                toName,
                                imgTo,
                                "Derived item",
                                metaLine(toBase)
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold tabular-nums">
                                {formatMoneyHKD(dr.costTotal)}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {new Date(dr.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {dr.costLines.length ? (
                            <p className="mt-1 pl-6 text-xs text-muted-foreground">
                              {dr.costLines
                                .map((c) => `${c.type} ${formatMoneyHKD(Number(c.price) || 0)}`)
                                .join(" · ")}
                            </p>
                          ) : (
                            <p className="mt-1 pl-6 text-xs text-muted-foreground">No cost entries.</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}
    </section>
  )
}
