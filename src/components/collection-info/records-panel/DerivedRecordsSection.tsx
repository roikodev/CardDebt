import type { CollectionBase, DerivedRecordRow } from "@/components/collection-info/types"
import { SkeletonMuted } from "@/components/collection-info/records-panel/shared"
import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

type Props = {
  derivedError: string | null
  derivedLoading: boolean
  derivedRecords: DerivedRecordRow[]
  derivedImageUrls: Record<string, string>
  formatMoneyHKD: (n: number) => string
}

export function DerivedRecordsSection({
  derivedError,
  derivedLoading,
  derivedRecords,
  derivedImageUrls,
  formatMoneyHKD,
}: Props) {
  if (derivedError) return <p className="text-sm text-destructive">{derivedError}</p>
  if (derivedLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border bg-background/40 p-3">
            <SkeletonMuted className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <SkeletonMuted className="h-4 w-full max-w-[10rem]" />
              <div className="mt-2 min-w-0">
                <SkeletonMuted className="h-3 w-full max-w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (!derivedRecords.length) return <p className="text-sm text-muted-foreground">No derived records found.</p>

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
            <img src={img} alt={baseName} className="h-full w-full object-cover object-left-top" loading="lazy" />
          ) : (
            <div className="h-full w-full animate-pulse bg-muted/50" />
          )}
        </div>
        <div className="min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
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
        (max, r) => (new Date(r.created_at).getTime() > max ? new Date(r.created_at).getTime() : max),
        0
      )
      return { fromId, rows, latest }
    })
    .sort((a, b) => b.latest - a.latest)

  return (
    <div className="space-y-3">
      {orderedGroups.map(({ fromId, rows }) => {
        const first = rows[0]
        const fromBase = first.from_user_collection?.collection_base
        const fromName = fromBase?.name ?? "Source"
        const imgFrom = derivedImageUrls[`from:${fromId}`]
        const fromItemId = first.from_user_collection?.collection_item_id
        const fromG = first.from_user_collection?.graded ?? false

        const derivedRows = [...rows].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        const sourceDerivedTotal = derivedRows.reduce((sum, r) => sum + (Number(r.costTotal) || 0), 0)

        return (
          <div key={`src-${fromId}`} className="rounded-xl border bg-background/30 p-3 text-left">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {sideLink(fromItemId, fromG, fromName, imgFrom, "Source", metaLine(fromBase))}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground">Total deriving cost</p>
                <p className="text-sm font-semibold tabular-nums">{formatMoneyHKD(sourceDerivedTotal)}</p>
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
                        {sideLink(toItemId, toG, toName, imgTo, "Derived item", metaLine(toBase))}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatMoneyHKD(dr.costTotal)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(dr.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {dr.costLines.length ? (
                      <p className="mt-1 pl-6 text-xs text-muted-foreground">
                        {dr.costLines.map((c) => `${c.type} ${formatMoneyHKD(Number(c.price) || 0)}`).join(" · ")}
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
      })}
    </div>
  )
}
