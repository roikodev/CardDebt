import { SkeletonMuted } from "@/components/collection-info/records-panel/shared"
import type { GradingRecordRow } from "@/components/collection-info/types"
import { Button } from "@/components/ui/button"
import { UpdateGradingExecutionDialog } from "@/components/dialogs/UpdateGradingExecutionDialog"
import { EditGradingRecordDialog } from "@/components/dialogs/EditGradingRecordDialog"
import { CancelGradingRecordDialog } from "@/components/dialogs/CancelGradingRecordDialog"
import { useState } from "react"

type Props = {
  loading: boolean
  gradingRecords: GradingRecordRow[]
  sourceImageUrl: string | null
  sourceTitle: string
  formatMoneyHKD: (n: number) => string
  onUpdated?: () => void
}

export function GradingRecordsSection({
  loading,
  gradingRecords,
  sourceImageUrl,
  sourceTitle,
  formatMoneyHKD,
  onUpdated,
}: Props) {
  const [updating, setUpdating] = useState<null | { recordId: string; userCollectionId: string }>(null)
  const [editing, setEditing] = useState<null | { recordId: string; userCollectionId: string }>(null)
  const [cancelling, setCancelling] = useState<null | { recordId: string; userCollectionId: string }>(null)

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="min-w-0 overflow-hidden rounded-xl border bg-background/40 p-3">
            <SkeletonMuted className="h-4 w-full max-w-[10rem]" />
            <div className="mt-2 min-w-0">
              <SkeletonMuted className="h-3 w-full max-w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!gradingRecords.length) return <p className="text-sm text-muted-foreground">No grading records found.</p>

  return (
    <>
      <div className="space-y-2">
        {gradingRecords.map((r) => (
          <div key={r.id} className="rounded-xl border bg-background/40 p-3">
            <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted/30">
              {sourceImageUrl ? (
                <img src={sourceImageUrl} alt={sourceTitle} className="h-full w-full object-cover object-left-top" loading="lazy" />
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
            <div className="ml-auto flex shrink-0 flex-col items-end gap-2 text-right">
              <p className="text-sm font-semibold tabular-nums">{formatMoneyHKD(r.costTotal)}</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="bg-white text-black hover:bg-white/90"
                  onClick={() => setUpdating({ recordId: r.id, userCollectionId: r.user_collection_id })}
                >
                  Update
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing({ recordId: r.id, userCollectionId: r.user_collection_id })}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setCancelling({ recordId: r.id, userCollectionId: r.user_collection_id })}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
          {r.costLines.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {r.costLines.map((c) => `${c.type} ${formatMoneyHKD(Number(c.price) || 0)}`).join(" · ")}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No cost entries.</p>
          )}
          </div>
        ))}
      </div>

      <UpdateGradingExecutionDialog
        open={Boolean(updating)}
        onOpenChange={(o) => {
          if (!o) setUpdating(null)
        }}
        sendingRecordId={updating?.recordId ?? ""}
        userCollectionId={updating?.userCollectionId ?? ""}
        onUpdated={onUpdated}
      />

      <EditGradingRecordDialog
        open={Boolean(editing)}
        onOpenChange={(o) => {
          if (!o) setEditing(null)
        }}
        userCollectionId={editing?.userCollectionId ?? ""}
        initialLines={
          gradingRecords.find((x) => x.id === editing?.recordId)?.costLines ?? []
        }
        onSaved={onUpdated}
      />

      <CancelGradingRecordDialog
        open={Boolean(cancelling)}
        onOpenChange={(o) => {
          if (!o) setCancelling(null)
        }}
        sendingRecordId={cancelling?.recordId ?? ""}
        userCollectionId={cancelling?.userCollectionId ?? ""}
        costLines={gradingRecords.find((x) => x.id === cancelling?.recordId)?.costLines ?? []}
        onCancelled={onUpdated}
      />
    </>
  )
}
