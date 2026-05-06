import { Button } from "@/components/ui/button"
import { GradedChip } from "@/components/GradedChip"
import { GradingChip } from "@/components/GradingChip"
import { AvailableChip } from "@/components/AvailableChip"
import type { CollectionBase } from "@/components/collection-info/types"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"
import { DeleteUserCollectionItemsDialog } from "@/components/dialogs/DeleteUserCollectionItemsDialog"
import { EditCollectionBaseDialog } from "@/components/dialogs/EditCollectionBaseDialog"
import { BadgeCheck, Pencil, Sparkles, Trash2 } from "lucide-react"

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
  workerOrigin?: string
  gradedLevelCounts: Record<string, { provider: string; grade: number; count: number }>
  gradingCount: number
  overviewCounts: { available: number; grading: number; derived: number }
  item: CollectionBase | null
  itemFields: Array<{ label: string; value: string | null }>
  sourceQuantity: number
  availableQuantity: number
  graded: boolean
  onOpenGrade: () => void
  onOpenDerive: () => void
  onDeleted?: () => void
  onEdited?: () => void
}

export function ItemInfoCard({
  loading,
  imageUrl,
  title,
  workerOrigin,
  gradedLevelCounts,
  gradingCount,
  overviewCounts,
  item,
  itemFields,
  sourceQuantity,
  availableQuantity,
  graded,
  onOpenGrade,
  onOpenDerive,
  onDeleted,
  onEdited,
}: Props) {
  const disableActions = loading || !item || availableQuantity <= 0
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
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
      <div className="sm:grid sm:grid-cols-[minmax(220px,40%)_1fr] sm:items-stretch sm:gap-4 lg:block">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
          <div className="aspect-[4/3] w-full max-h-48 min-h-0 bg-white/5 sm:aspect-auto sm:h-full sm:max-h-none lg:aspect-[4/3] lg:h-auto lg:max-h-44">
            {imageUrl ? (
              <div className="flex h-full w-full items-center justify-center">
                <img
                  src={imageUrl}
                  alt={title}
                  className="h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="h-full w-full animate-pulse bg-white/10" />
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2 sm:mt-0 lg:mt-4">
          <div className="space-y-2">
          {loading && gradedLevels.length === 0 && gradingCount === 0 ? (
            <div className="flex min-w-0 items-center justify-start">
              <Skeleton className="h-5 w-full max-w-28" />
            </div>
          ) : gradedLevels.length > 0 || gradingCount > 0 || overviewCounts.available > 0 ? (
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
              {!graded && overviewCounts.available > 0 ? (
                <AvailableChip count={overviewCounts.available} tone="dark" />
              ) : null}
              {gradingCount > 0 ? <GradingChip count={gradingCount} tone="dark" /> : null}
            </div>
          ) : loading ? (
            <Skeleton className="h-5 w-full max-w-32" />
          ) : (
            <div className="flex items-center justify-start">
              {gradingCount > 0 ? <GradingChip count={gradingCount} tone="dark" /> : null}
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

          {/* Overview chips removed; shown as mini chips above. */}
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
          <div className={!graded ? "space-y-2 sm:flex sm:gap-2 sm:space-y-0" : undefined}>
            {!graded ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full bg-white text-black hover:bg-white/90 sm:flex-1"
                onClick={onOpenGrade}
                disabled={disableActions}
              >
                <BadgeCheck className="-ml-0.5 mr-2 size-4" aria-hidden="true" />
                Grade
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="w-full bg-white text-black hover:bg-white/90 sm:flex-1"
              onClick={onOpenDerive}
              disabled={disableActions}
            >
              <Sparkles className="-ml-0.5 mr-2 size-4" aria-hidden="true" />
              Derive
            </Button>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={() => setEditOpen(true)}
              disabled={loading || !item}
            >
              <Pencil className="-ml-0.5 mr-2 size-4" aria-hidden="true" />
              Edit
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={() => setDeleteOpen(true)}
              disabled={loading || !item || availableQuantity <= 0}
            >
              <Trash2 className="-ml-0.5 mr-2 size-4" aria-hidden="true" />
              Delete Items
            </Button>
          </div>
          </div>
        </div>
      </div>

      <DeleteUserCollectionItemsDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        collectionItemId={item?.id ?? ""}
        graded={graded}
        maxQuantity={availableQuantity}
        onDeleted={onDeleted}
      />

      <EditCollectionBaseDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workerOrigin={workerOrigin}
        collectionItemId={item?.id ?? ""}
        initial={{
          name: item?.name ?? null,
          game_title: item?.game_title ?? null,
          card_no: item?.card_no ?? null,
          image_cloud_path: item?.image_cloud_path ?? null,
        }}
        onEdited={onEdited}
      />
    </section>
  )
}
