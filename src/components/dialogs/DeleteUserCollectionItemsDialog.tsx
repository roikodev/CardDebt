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
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionItemId: string
  graded: boolean
  maxQuantity: number
  onDeleted?: () => void
}

export function DeleteUserCollectionItemsDialog({
  open,
  onOpenChange,
  collectionItemId,
  graded,
  maxQuantity,
  onDeleted,
}: Props) {
  const [qty, setQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    setQty(Math.min(1, Math.max(0, maxQuantity)) || 1)
  }, [open, maxQuantity])

  const clampedQty = useMemo(() => {
    const n = Number(qty) || 0
    return Math.max(1, Math.min(Math.floor(n), Math.max(0, maxQuantity)))
  }, [qty, maxQuantity])

  async function handleDelete() {
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

    if (!collectionItemId) {
      setError("Missing item id.")
      setSaving(false)
      return
    }

    const want = Math.max(1, Math.min(clampedQty, Math.max(0, maxQuantity)))
    if (want <= 0) {
      setError("Nothing to delete.")
      setSaving(false)
      return
    }

    // Only items with grading=false and derived=false can be deleted.
    const pickRes = await supabase
      .from("user_collection")
      .select("id")
      .eq("user_id", userId)
      .eq("collection_item_id", collectionItemId)
      .eq("graded", graded)
      .eq("grading", false)
      .eq("derived", false)
      .eq("deleted", false)
      .order("created_at", { ascending: true })
      .limit(want)

    if (pickRes.error) {
      setError(pickRes.error.message)
      setSaving(false)
      return
    }

    const ids = Array.from(
      new Set(
        (pickRes.data ?? [])
          .map((r) => (r as { id: string | null }).id)
          .filter((v): v is string => Boolean(v))
      )
    )

    if (ids.length < want) {
      setError(`Not enough eligible items to delete. Available: ${ids.length}.`)
      setSaving(false)
      return
    }

    const updRes = await supabase
      .from("user_collection")
      .update({ deleted: true })
      .eq("user_id", userId)
      .in("id", ids)
      .eq("deleted", false)

    if (updRes.error) {
      setError(updRes.error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onOpenChange(false)
    toast.success("Deleted successfully", { duration: 5000 })
    onDeleted?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,30rem)] overflow-x-hidden sm:max-w-md p-0">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>Delete items</DialogTitle>
            <DialogDescription>
              Choose how many items you want to delete. Only items with <span className="font-medium">grading=false</span>{" "}
              and <span className="font-medium">derived=false</span> can be deleted.
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <div className="mt-4 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium text-foreground">Quantity</div>
                <div className="text-xs text-muted-foreground">Max: {maxQuantity}</div>
              </div>
              <div className="w-28">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={Math.max(1, maxQuantity)}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Back
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving || maxQuantity <= 0}>
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

