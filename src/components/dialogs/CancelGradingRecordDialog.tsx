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
import type { MiscCostLine } from "@/components/collection-info/types"

export type CancelGradingRecordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sendingRecordId: string
  userCollectionId: string
  costLines: MiscCostLine[]
  onCancelled?: () => void
}

export function CancelGradingRecordDialog({
  open,
  onOpenChange,
  sendingRecordId,
  userCollectionId,
  costLines,
  onCancelled,
}: CancelGradingRecordDialogProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSaving(false)
    setError(null)
  }, [open])

  const miscIds = useMemo(() => costLines.map((c) => c.id).filter(Boolean), [costLines])

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

    if (miscIds.length) {
      const delMapRes = await supabase
        .from("user_collection_miscellaneous")
        .delete()
        .eq("user_id", userId)
        .eq("user_collection_id", userCollectionId)
        .in("miscellaneous_entries_id", miscIds)

      if (delMapRes.error) {
        setError(delMapRes.error.message)
        setSaving(false)
        return
      }

      const delMiscRes = await supabase
        .from("miscellaneous_entries")
        .delete()
        .eq("user_id", userId)
        .in("id", miscIds)

      if (delMiscRes.error) {
        setError(delMiscRes.error.message)
        setSaving(false)
        return
      }
    }

    const ucUpd = await supabase
      .from("user_collection")
      .update({ grading: false })
      .eq("user_id", userId)
      .eq("id", userCollectionId)
      .eq("deleted", false)

    if (ucUpd.error) {
      setError(ucUpd.error.message)
      setSaving(false)
      return
    }

    const execUpd = await supabase
      .from("user_collection_sending_to_grade")
      .update({ executed: true })
      .eq("user_id", userId)
      .eq("id", sendingRecordId)
      .eq("executed", false)

    if (execUpd.error) {
      setError(execUpd.error.message)
      setSaving(false)
      return
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
            <DialogTitle>{t("dialogs.cancelGradingTitle")}</DialogTitle>
            <DialogDescription>{t("dialogs.cancelGrading.description")}</DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <div className="mt-4 rounded-xl border bg-card p-3 text-sm">
            <p className="font-medium">{t("dialogs.cancelGrading.aboutToDelete")}</p>
            <p className="mt-1 text-muted-foreground">
              {t("dialogs.cancelGrading.costEntries", { count: miscIds.length })}
            </p>
          </div>
        </DialogBody>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("dialogs.back")}
            </Button>
            <Button type="button" variant="destructive" onClick={handleCancel} disabled={saving}>
              {t("dialogs.cancelGrading.confirm")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
