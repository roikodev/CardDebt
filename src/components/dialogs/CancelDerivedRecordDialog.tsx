import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

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
import { toastCancelled } from "@/lib/toastI18n"

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
  const { t } = useTranslation()
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
        setError(t("dialogs.notSignedIn"))
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
  }, [open, t, toUserCollectionId])

  const warning = useMemo(() => {
    if (!toInfo) return null
    if (toInfo.grading) {
      return t("dialogs.cancelDerived.warningGrading")
    }
    if (!toInfo.exists || toInfo.deleted) {
      return t("dialogs.cancelDerived.warningQty")
    }
    if (toInfo.currentQty > 1) {
      return t("dialogs.cancelDerived.warningMultipleCopies", { count: toInfo.currentQty })
    }
    return null
  }, [toInfo, t])

  async function handleCancel() {
    if (saving) return
    setSaving(true)
    setError(null)

    const userRes = await supabase.auth.getUser()
    const userId = userRes.data.user?.id ?? null
    if (!userId) {
      setError(t("dialogs.notSignedIn"))
      setSaving(false)
      return
    }

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
      setError(t("dialogs.cancelDerived.deleteFailed"))
      setSaving(false)
      return
    }

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
    toastCancelled()
    onCancelled?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,34rem)] overflow-x-hidden sm:max-w-md p-0">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>{t("dialogs.cancelDerivedTitle")}</DialogTitle>
            <DialogDescription>{t("dialogs.cancelDerived.description")}</DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              {warning ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                  {warning}
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border bg-card p-3 text-sm text-muted-foreground">
                {t("dialogs.cancelDerived.proceedToCancel")}
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("dialogs.back")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
              disabled={saving || loading}
            >
              {t("dialogs.cancel")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
