import { Button } from "@/components/ui/button"
import { GradedChip } from "@/components/GradedChip"
import { GradingChip } from "@/components/GradingChip"
import type { CollectionBase } from "@/components/collection-info/types"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={cn(
        "min-h-[0.5rem] min-w-0 max-w-full overflow-hidden rounded-md bg-white/10 animate-pulse",
        className
      )}
    />
  )
}

type Props = {
  loading: boolean
  imageUrl: string | null
  title: string
  gradedLevelCounts: Record<string, { provider: string; grade: number; count: number }>
  gradingCount: number
  item: CollectionBase | null
  itemFields: Array<{ label: string; value: string | null }>
  sourceQuantity: number
  availableQuantity: number
  graded: boolean
  onOpenGrade: () => void
  onOpenDerive: () => void
}

export function ItemInfoCard({
  loading,
  imageUrl,
  title,
  gradedLevelCounts,
  gradingCount,
  item,
  itemFields,
  sourceQuantity,
  availableQuantity,
  graded,
  onOpenGrade,
  onOpenDerive,
}: Props) {
  const disableActions = loading || !item || availableQuantity <= 0
  const gradedLevels = useMemo(() => {
    const levels = Object.values(gradedLevelCounts) as Array<{
      provider: string
      grade: number
      count: number
    }>
    return levels.sort((a, b) => b.grade - a.grade)
  }, [gradedLevelCounts])

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-zinc-900 p-3 text-left text-white sm:p-4 lg:sticky lg:top-6 lg:self-start">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
        <div className="aspect-[4/3] w-full max-h-72 min-h-0 bg-white/5">
          {imageUrl ? (
            <img src={imageUrl} alt={title} className="h-full w-full object-contain" />
          ) : (
            <div className="h-full w-full animate-pulse bg-white/10" />
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading && gradedLevels.length === 0 && gradingCount === 0 ? (
          <div className="flex min-w-0 items-center justify-start">
            <Skeleton className="h-5 w-full max-w-28" />
          </div>
        ) : gradedLevels.length > 0 || gradingCount > 0 ? (
          <div className="flex flex-wrap items-center justify-start gap-2">
            {gradedLevels.map((lvl) => (
              <GradedChip
                key={`${lvl.provider}-${lvl.grade}`}
                provider={lvl.provider}
                grade={lvl.grade}
                count={lvl.count}
                tone="dark"
              />
            ))}
            {gradingCount > 0 ? <GradingChip count={gradingCount} tone="dark" /> : null}
          </div>
        ) : loading ? (
          <Skeleton className="h-5 w-full max-w-32" />
        ) : (
          <div className="flex items-center justify-start">
            <GradingChip count={gradingCount} tone="dark" />
          </div>
        )}

        {loading && !item ? (
          <Skeleton className="h-5 w-full max-w-[14rem]" />
        ) : (
          <h1 className="m-0 text-base font-semibold leading-snug">{title}</h1>
        )}

        <div className="grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-[minmax(0,110px)_1fr] sm:gap-3">
          <span className="text-white/60">Current quantity</span>
          <span className="min-w-0 text-white/90">{sourceQuantity}</span>
        </div>

        <dl className="space-y-2 text-sm">
          {loading && !item ? (
            <>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,110px)_1fr] sm:gap-3">
                <dt className="text-white/60">Game Title</dt>
                <dd className="min-w-0">
                  <Skeleton className="h-4 w-full max-w-[10rem]" />
                </dd>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,110px)_1fr] sm:gap-3">
                <dt className="text-white/60">Card Number</dt>
                <dd className="min-w-0">
                  <Skeleton className="h-4 w-full max-w-[8rem]" />
                </dd>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,110px)_1fr] sm:gap-3">
                <dt className="text-white/60">Name</dt>
                <dd className="min-w-0">
                  <Skeleton className="h-4 w-full max-w-[14rem]" />
                </dd>
              </div>
            </>
          ) : itemFields.length ? (
            itemFields.map((f) => (
              <div
                key={f.label}
                className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,110px)_1fr] sm:gap-3"
              >
                <dt className="text-white/60">{f.label}</dt>
                <dd className="min-w-0 text-white/90">{f.value}</dd>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/60">No item details found.</p>
          )}
        </dl>

        <div className="pt-2">
          {!graded ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={onOpenGrade}
              disabled={disableActions}
            >
              Grade
            </Button>
          ) : null}
          <div className={!graded ? "mt-2" : undefined}>
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={onOpenDerive}
              disabled={disableActions}
            >
              Derive
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
