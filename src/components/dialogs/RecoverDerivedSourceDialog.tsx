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
import {
  collectRecoverWarnings,
  loadDerivedTargetInfo,
  recoverDerivedSourceMappings,
  type DerivedMappingRef,
  type DerivedTargetInfo,
} from "@/lib/recoverDerivedSource"
import { toastRecovered } from "@/lib/toastI18n"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fromUserCollectionId: string
  mappings: DerivedMappingRef[]
  onRecovered?: () => void
}

export function RecoverDerivedSourceDialog({
  open,
  onOpenChange,
  fromUserCollectionId,
  mappings,
  onRecovered,
}: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targets, setTargets] = useState<DerivedTargetInfo[]>([])

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    setLoading(true)
    setTargets([])

    ;(async () => {
      const userRes = await supabase.auth.getUser()
      const userId = userRes.data.user?.id ?? null
      if (!userId) {
        setError(t("dialogs.notSignedIn"))
        setLoading(false)
        return
      }

      const loaded: DerivedTargetInfo[] = []
      for (const m of mappings) {
        const res = await loadDerivedTargetInfo(supabase, userId, m.toUserCollectionId)
        if (res.error) {
          setError(res.error)
          setLoading(false)
          return
        }
        if (res.data) loaded.push(res.data)
      }

      setTargets(loaded)
      setLoading(false)
    })()
  }, [open, mappings, t])

  const warnings = useMemo(() => collectRecoverWarnings(targets, t), [targets, t])

  async function handleRecover() {
    if (saving || !mappings.length) return
    setSaving(true)
    setError(null)

    const userRes = await supabase.auth.getUser()
    const userId = userRes.data.user?.id ?? null
    if (!userId) {
      setError(t("dialogs.notSignedIn"))
      setSaving(false)
      return
    }

    const result = await recoverDerivedSourceMappings(
      supabase,
      userId,
      fromUserCollectionId,
      mappings,
      t("dialogs.recoverDerived.deleteFailed")
    )

    if (!result.ok) {
      setError(result.error)
      setSaving(false)
      return
    }

    setSaving(false)
    onOpenChange(false)
    toastRecovered()
    onRecovered?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,34rem)] overflow-x-hidden sm:max-w-md p-0">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>{t("dialogs.recoverDerivedTitle")}</DialogTitle>
            <DialogDescription>{t("dialogs.recoverDerived.description")}</DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                {t("dialogs.recoverDerived.mappingCount", { count: mappings.length })}
              </p>
              {warnings.length ? (
                <div className="mt-4 space-y-2">
                  {warnings.map((w) => (
                    <div
                      key={w}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
                    >
                      {w}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border bg-card p-3 text-sm text-muted-foreground">
                {t("dialogs.recoverDerived.proceed")}
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
              onClick={handleRecover}
              disabled={saving || loading || !mappings.length}
            >
              {t("dialogs.recoverDerived.confirm")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
