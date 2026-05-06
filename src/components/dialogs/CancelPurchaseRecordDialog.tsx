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
  buyEntryId: string
  onCancelled?: () => void
}

export function CancelPurchaseRecordDialog({ open, onOpenChange, buyEntryId, onCancelled }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [info, setInfo] = useState<null | {
    graded: boolean
    quantity: number
    purchase_date: string
    collection_item_id: string
    eligibleCount: number
    linkedEligibleCount: number
  }>(null)

  useEffect(() => {
    if (!open) return
    if (!buyEntryId) return
    setError(null)
    setSaving(false)
    setLoading(true)
    setInfo(null)

    ;(async () => {
      const userRes = await supabase.auth.getUser()
      const userId = userRes.data.user?.id ?? null
      if (!userId) {
        setError("You are not signed in.")
        setLoading(false)
        return
      }

      const beRes = await supabase
        .from("buy_entries")
        .select("id, graded, quantity, purchase_date, collection_item_id")
        .eq("user_id", userId)
        .eq("id", buyEntryId)
        .maybeSingle()

      if (beRes.error) {
        setError(beRes.error.message)
        setLoading(false)
        return
      }

      const be = beRes.data as
        | { id: string; graded: boolean; quantity: number; purchase_date: string; collection_item_id: string }
        | null

      if (!be) {
        setError("Purchase record not found.")
        setLoading(false)
        return
      }

      const eligibleRes = await supabase
        .from("user_collection")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("collection_item_id", be.collection_item_id)
        .eq("graded", be.graded)
        .eq("derived", false)
        .eq("grading", false)
        .eq("deleted", false)

      if (eligibleRes.error) {
        setError(eligibleRes.error.message)
        setLoading(false)
        return
      }

      const linkedEligibleRes = await supabase
        .from("user_collection")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("buying_entries_id", buyEntryId)
        .eq("graded", be.graded)
        .eq("derived", false)
        .eq("grading", false)
        .eq("deleted", false)

      if (linkedEligibleRes.error) {
        setError(linkedEligibleRes.error.message)
        setLoading(false)
        return
      }

      setInfo({
        graded: Boolean(be.graded),
        quantity: Number(be.quantity) || 0,
        purchase_date: be.purchase_date,
        collection_item_id: be.collection_item_id,
        eligibleCount: Number(eligibleRes.count ?? 0),
        linkedEligibleCount: Number(linkedEligibleRes.count ?? 0),
      })
      setLoading(false)
    })()
  }, [open, buyEntryId])

  const warning = useMemo(() => {
    if (!info) return null
    if (info.quantity <= 0) return null
    if (info.linkedEligibleCount < info.quantity) {
      return "Warning: there aren't enough eligible items to consume/rollback this purchase (some items may have been derived, sent to grading, deleted, or otherwise moved). We can still delete this purchase record, but some or all purchased items will NOT be consumed."
    }
    return null
  }, [info])

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

    const beRes = await supabase
      .from("buy_entries")
      .select("id, graded, quantity")
      .eq("user_id", userId)
      .eq("id", buyEntryId)
      .maybeSingle()

    if (beRes.error) {
      setError(beRes.error.message)
      setSaving(false)
      return
    }

    const be = beRes.data as { id: string; graded: boolean; quantity: number } | null
    if (!be) {
      setError("Purchase record not found.")
      setSaving(false)
      return
    }

    const qty = Math.max(0, Number(be.quantity) || 0)

    // 1) Consume up to `qty` user_collection rows that are still eligible and linked to this buy entry.
    if (qty > 0) {
      const pickRes = await supabase
        .from("user_collection")
        .select("id")
        .eq("user_id", userId)
        .eq("buying_entries_id", buyEntryId)
        .eq("graded", be.graded)
        .eq("derived", false)
        .eq("grading", false)
        .eq("deleted", false)
        .limit(qty)

      if (pickRes.error) {
        setError(pickRes.error.message)
        setSaving(false)
        return
      }

      const ids = Array.from(
        new Set((pickRes.data ?? []).map((r) => (r as { id: string | null }).id).filter((v): v is string => Boolean(v)))
      )

      if (ids.length) {
        const delUc = await supabase.from("user_collection").delete().eq("user_id", userId).in("id", ids)
        if (delUc.error) {
          setError(delUc.error.message)
          setSaving(false)
          return
        }
      }
    }

    // 2) Delete buy entry (buy_entry_grading will be removed via FK cascade).
    const delBe = await supabase
      .from("buy_entries")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .eq("id", buyEntryId)

    if (delBe.error) {
      setError(delBe.error.message)
      setSaving(false)
      return
    }
    if (!delBe.count) {
      setError(
        "Failed to remove the purchase record (no rows were deleted). This is usually caused by a missing RLS DELETE policy on public.buy_entries."
      )
      setSaving(false)
      return
    }

    setSaving(false)
    onOpenChange(false)
    toast.success("Cancelled successfully", { duration: 5000 })
    onCancelled?.()
  }

  const title = info ? `Cancel purchase (${info.purchase_date})` : "Cancel purchase"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,34rem)] overflow-x-hidden sm:max-w-md p-0">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              This will remove the purchase record and attempt to consume the same quantity from your collection (only items that are not derived and not in grading).
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {info ? (
                <div className="mt-4 rounded-xl border bg-card p-3 text-sm text-muted-foreground">
                  <div>Type: {info.graded ? "Graded" : "Raw"}</div>
                  <div>Quantity: {info.quantity}</div>
                </div>
              ) : null}

              {warning ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                  {warning}
                </div>
              ) : null}
            </>
          )}
        </DialogBody>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Back
            </Button>
            <Button type="button" variant="destructive" onClick={handleCancel} disabled={saving || loading}>
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

