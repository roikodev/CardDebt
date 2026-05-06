import { useEffect, useMemo, useState } from "react"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordId: string
  fromUserCollectionId: string
  toUserCollectionId: string
  onCancelled?: () => void
}

export function CancelDerivedRecordDialog({
  open,
  onOpenChange,
  recordId,
  fromUserCollectionId,
  toUserCollectionId,
  onCancelled,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [toInfo, setToInfo] = useState<null | {
    exists: boolean
    deleted: boolean
    collection_item_id: string | null
    graded: boolean
    grading: boolean
    currentQty: number
  }>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    setLoading(true)
    setToInfo(null)

    ;(async () => {
      const userRes = await supabase.auth.getUser()
      const userId = userRes.data.user?.id ?? null
      if (!userId) {
        setError("You are not signed in.")
        setLoading(false)
        return
      }

      const toRes = await supabase
        .from("user_collection")
        .select("id, deleted, collection_item_id, graded, grading")
        .eq("user_id", userId)
        .eq("id", toUserCollectionId)
        .maybeSingle()

      if (toRes.error) {
        setError(toRes.error.message)
        setLoading(false)
        return
      }

      const toRow = toRes.data as
        | { id: string; deleted: boolean; collection_item_id: string; graded: boolean; grading: boolean }
        | null

      if (!toRow) {
        setToInfo({
          exists: false,
          deleted: true,
          collection_item_id: null,
          graded: false,
          grading: false,
          currentQty: 0,
        })
        setLoading(false)
        return
      }

      const qtyRes = await supabase
        .from("user_collection")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("collection_item_id", toRow.collection_item_id)
        .eq("graded", toRow.graded)
        .eq("derived", false)
        .eq("deleted", false)

      if (qtyRes.error) {
        setError(qtyRes.error.message)
        setLoading(false)
        return
      }

      setToInfo({
        exists: true,
        deleted: Boolean(toRow.deleted),
        collection_item_id: toRow.collection_item_id,
        graded: Boolean(toRow.graded),
        grading: Boolean(toRow.grading),
        currentQty: Number(qtyRes.count ?? 0),
      })
      setLoading(false)
    })()
  }, [open, toUserCollectionId])

  const warning = useMemo(() => {
    if (!toInfo) return null
    if (toInfo.grading) {
      return "Warning: this derived item is currently being graded, so it cannot be consumed/rolled back. We can still delete this derived mapping and its miscellaneous records, and restore the source item, but the derived item will NOT be consumed."
    }
    if (!toInfo.exists || toInfo.deleted) {
      return "Warning: your derived item quantity is not enough to rollback (the derived item is missing or already removed). We can still delete this derived mapping and its miscellaneous records, and restore the source item, but the derived item will NOT be consumed."
    }
    // Requirement from you: warn when required quantity is less than current quantity.
    // Here required is always 1 derived mapping.
    if (toInfo.currentQty > 1) {
      return `Warning: you currently have ${toInfo.currentQty} copies of this derived item. Cancelling will remove 1 copy, which may be confusing when you have multiple copies.`
    }
    return null
  }, [toInfo])

  async function handleCancel() {
    if (saving) return
    setSaving(true)
    setError(null)

    const userRes = await supabase.auth.getUser()
    const userId = userRes.data.user?.id ?? null
    if (!userId) {
      setError("You are not signed in.")
      setSaving(false)
      return
    }

    // 1) Find related misc entries via user_derived_collection_miscellaneous
    const linksRes = await supabase
      .from("user_derived_collection_miscellaneous")
      .select("miscellaneous_entries_id")
      .eq("user_id", userId)
      .eq("user_derived_collection_id", recordId)

    if (linksRes.error) {
      setError(linksRes.error.message)
      setSaving(false)
      return
    }

    const miscIds = Array.from(
      new Set(
        (linksRes.data ?? [])
          .map((r) => (r as { miscellaneous_entries_id: string | null }).miscellaneous_entries_id)
          .filter((v): v is string => Boolean(v))
      )
    )

    // Delete link rows then misc rows.
    if (miscIds.length) {
      const delLinks = await supabase
        .from("user_derived_collection_miscellaneous")
        .delete()
        .eq("user_id", userId)
        .eq("user_derived_collection_id", recordId)
        .in("miscellaneous_entries_id", miscIds)

      if (delLinks.error) {
        setError(delLinks.error.message)
        setSaving(false)
        return
      }

      const delMisc = await supabase
        .from("miscellaneous_entries")
        .delete()
        .eq("user_id", userId)
        .in("id", miscIds)

      if (delMisc.error) {
        setError(delMisc.error.message)
        setSaving(false)
        return
      }
    }

    // 2) Rollback: consume the derived item if it still exists and isn't deleted.
    const toRes = await supabase
      .from("user_collection")
      .select("id, deleted, grading")
      .eq("user_id", userId)
      .eq("id", toUserCollectionId)
      .maybeSingle()

    if (toRes.error) {
      setError(toRes.error.message)
      setSaving(false)
      return
    }

    const toRow = toRes.data as { id: string; deleted: boolean; grading: boolean } | null
    if (toRow && !toRow.deleted && !toRow.grading) {
      const delTo = await supabase
        .from("user_collection")
        .delete()
        .eq("user_id", userId)
        .eq("id", toUserCollectionId)

      if (delTo.error) {
        setError(delTo.error.message)
        setSaving(false)
        return
      }
    }

    // 3) Remove the derived mapping record itself.
    const delMap = await supabase
      .from("user_derived_collection")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .eq("id", recordId)

    if (delMap.error) {
      setError(delMap.error.message)
      setSaving(false)
      return
    }
    if (!delMap.count) {
      setError(
        "Failed to remove the derived mapping record (no rows were deleted). This is usually caused by a missing RLS DELETE policy on public.user_derived_collection."
      )
      setSaving(false)
      return
    }

    // 4) Restore source item derived=false if no other derived mappings remain for that source row.
    const remainingRes = await supabase
      .from("user_derived_collection")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("from_user_collection_id", fromUserCollectionId)

    if (remainingRes.error) {
      setError(remainingRes.error.message)
      setSaving(false)
      return
    }

    const remaining = Number(remainingRes.count ?? 0)
    if (remaining === 0) {
      const restore = await supabase
        .from("user_collection")
        .update({ derived: false })
        .eq("user_id", userId)
        .eq("id", fromUserCollectionId)
        .eq("deleted", false)

      if (restore.error) {
        setError(restore.error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onOpenChange(false)
    toast.success("Cancelled successfully", { duration: 5000 })
    onCancelled?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,34rem)] overflow-x-hidden sm:max-w-md p-0">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>Cancel derived record</DialogTitle>
            <DialogDescription>
              This will delete the costs linked to this derived record, remove the derived mapping, and restore the source item when possible.
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {warning ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                  {warning}
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border bg-card p-3 text-sm text-muted-foreground">
                You can proceed to cancel this derived record.
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
              disabled={saving || loading}
            >
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

