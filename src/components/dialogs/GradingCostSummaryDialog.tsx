import { useEffect, useMemo, useRef, useState } from "react"
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
import { toastSaved } from "@/lib/toastI18n"

type CostType = "Grading" | "Postal" | "Other"

type CostEntry = {
  id: string
  date: string
  type: CostType
  description: string
  costHKD: string
}

type SourceBase = {
  id: string
  game_title: string | null
  card_no: string | null
  name: string | null
  image_cloud_path: string | null
}

type SourceUserCollectionRow = {
  id: string
  created_at: string
  collection_item_id: string
  graded: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionItemId: string
  sourceQuantity: number
  quantity: number
  sendingDate: string
  costs: CostEntry[]
  onDone?: () => void
  onBack?: () => void
}

function sumCosts(costs: CostEntry[] | undefined): number {
  if (!costs?.length) return 0
  return costs.reduce((sum, c) => sum + (Number(c.costHKD) || 0), 0)
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random())
}

export function GradingCostSummaryDialog({
  open,
  onOpenChange,
  collectionItemId,
  sourceQuantity,
  quantity,
  sendingDate,
  costs,
  onDone,
  onBack,
}: Props) {
  const { t } = useTranslation()
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined
  const [source, setSource] = useState<SourceBase | null>(null)
  const [sourceImg, setSourceImg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const emDash = t("common.emDash")

  const moneyHKD = (n: number): string => {
    if (!Number.isFinite(n)) return `HKD$${emDash}`
    return `HKD$${n.toFixed(2)}`
  }

  const costTypeLabel = (type: CostType) =>
    type === "Grading"
      ? t("dialogs.costType.grading")
      : type === "Postal"
        ? t("dialogs.costType.postal")
        : t("dialogs.costType.other")

  const per1 = useMemo(() => sumCosts(costs), [costs])
  const total = useMemo(() => per1 * (Number(quantity) || 0), [per1, quantity])
  const perOneStr = moneyHKD(per1)

  useEffect(() => {
    if (!open) return
    setSource(null)
    setSourceImg(null)
    setSubmitError(null)
    setSubmitting(false)
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    ;(async () => {
      const itemRes = await supabase
        .from("collection_base")
        .select("id, game_title, card_no, name, image_cloud_path")
        .eq("id", collectionItemId)
        .single()

      if (signal.aborted) return
      if (itemRes.data) setSource(itemRes.data as SourceBase)

      const filePath = (itemRes.data as SourceBase | null)?.image_cloud_path ?? null
      if (!filePath) return

      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token
      if (!token) return

      if (!workerOrigin?.trim()) return
      const baseUrl = workerOrigin.replace(/\/+$/, "")

      const signedRes = await fetch(
        `${baseUrl}/signed?file=${encodeURIComponent(filePath)}&ttl=300`,
        { headers: { Authorization: `Bearer ${token}` }, signal }
      )
      if (!signedRes.ok) return
      const data = (await signedRes.json()) as { url?: string }
      if (data.url) setSourceImg(data.url)
    })()

    return () => abortRef.current?.abort()
  }, [collectionItemId, open, workerOrigin])

  async function handleDone() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)

    const userRes = await supabase.auth.getUser()
    const userId = userRes.data.user?.id ?? null
    if (!userId) {
      setSubmitError(t("dialogs.notSignedIn"))
      setSubmitting(false)
      return
    }

    // Step 1: load source user_collection rows by collection_item_id + graded in ascending created_at.
    const takeCount = Math.max(0, Math.trunc(Number(quantity) || 0))
    if (!takeCount) {
      setSubmitError(t("dialogs.gradingCostSummary.quantityMin"))
      setSubmitting(false)
      return
    }

    const sourceRowsRes = await supabase
      .from("user_collection")
      .select("id, created_at, collection_item_id, graded")
      .eq("user_id", userId)
      .eq("collection_item_id", collectionItemId)
      .eq("graded", false)
      .eq("derived", false)
      .eq("grading", false)
      .eq("deleted", false)
      .order("created_at", { ascending: true })
      .limit(takeCount)

    if (sourceRowsRes.error) {
      setSubmitError(sourceRowsRes.error.message)
      setSubmitting(false)
      return
    }

    const sourceRows = (sourceRowsRes.data ?? []) as SourceUserCollectionRow[]
    if (sourceRows.length < takeCount) {
      setSubmitError(t("dialogs.gradingCostSummary.noSourceRecords"))
      setSubmitting(false)
      return
    }

    const targetIds = sourceRows.map((r) => r.id).filter((v): v is string => Boolean(v))
    if (!targetIds.length) {
      setSubmitError(t("dialogs.gradingCostSummary.noSourceRecords"))
      setSubmitting(false)
      return
    }

    const updateRes = await supabase
      .from("user_collection")
      .update({ grading: true })
      .in("id", targetIds)
      .eq("deleted", false)

    if (updateRes.error) {
      setSubmitError(updateRes.error.message)
      setSubmitting(false)
      return
    }

    const sentAtIso = sendingDate?.trim() ? `${sendingDate}T00:00:00` : null
    if (!sentAtIso) {
      setSubmitError(t("dialogs.gradingCostSummary.sendingDateRequired"))
      setSubmitting(false)
      return
    }

    const sendingRows = targetIds.map((id) => ({
      user_id: userId,
      user_collection_id: id,
      sent_at: sentAtIso,
    }))

    const sendingRes = await supabase
      .from("user_collection_sending_to_grade")
      .insert(sendingRows)

    if (sendingRes.error) {
      setSubmitError(sendingRes.error.message)
      setSubmitting(false)
      return
    }

    // For each sending-to-grade item, create miscellaneous entries from grading costs
    // and map them to user_collection_miscellaneous.
    const validCosts = costs.filter((c) => (c.date ?? "").trim().length > 0)
    if (validCosts.length) {
      const miscellaneousRows: Array<{
        id: string
        user_id: string
        type: string
        description: string | null
        price: number
        date: string
      }> = []
      const ucmRows: Array<{
        user_id: string
        user_collection_id: string
        miscellaneous_entries_id: string
      }> = []

      for (const userCollectionId of targetIds) {
        for (const c of validCosts) {
          const miscId = uid()
          miscellaneousRows.push({
            id: miscId,
            user_id: userId,
            type: c.type,
            description: c.description?.trim() ? c.description.trim() : null,
            price: Number(c.costHKD) || 0,
            date: c.date,
          })
          ucmRows.push({
            user_id: userId,
            user_collection_id: userCollectionId,
            miscellaneous_entries_id: miscId,
          })
        }
      }

      const miscRes = await supabase.from("miscellaneous_entries").insert(miscellaneousRows)
      if (miscRes.error) {
        setSubmitError(miscRes.error.message)
        setSubmitting(false)
        return
      }

      const ucmRes = await supabase.from("user_collection_miscellaneous").insert(ucmRows)
      if (ucmRes.error) {
        setSubmitError(ucmRes.error.message)
        setSubmitting(false)
        return
      }
    }

    onDone?.()
    onOpenChange(false)
    toastSaved()
    setSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,46rem)] overflow-x-hidden sm:max-w-lg p-0">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>{t("dialogs.gradingCostSummaryTitle")}</DialogTitle>
            <DialogDescription>{t("dialogs.gradingCostSummary.description")}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">{t("dialogs.gradingCostSummary.collectionItem")}</p>
              <div className="mt-2 flex items-start gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-lg border bg-muted/30">
                  {sourceImg ? (
                    <img
                      src={sourceImg}
                      alt={source?.name ?? t("dialogs.gradingCostSummary.collectionItemAlt")}
                      className="h-full w-full object-cover object-left-top"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-muted/50" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{source?.name ?? emDash}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[source?.game_title, source?.card_no].filter(Boolean).join(" · ") || emDash}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("dialogs.gradingCostSummary.currentQty", { count: sourceQuantity })}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">{t("dialogs.gradingCostSummary.costsPerOne")}</p>
              {costs.length ? (
                <div className="mt-3 space-y-2">
                  {costs.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {costTypeLabel(c.type)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            · {c.date}
                          </span>
                        </p>
                        {c.type === "Other" && c.description?.trim() ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.description.trim()}
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-sm font-semibold">
                        {moneyHKD(Number(c.costHKD) || 0)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t("dialogs.noCosts")}</p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{t("dialogs.quantity")}</p>
                <p className="text-sm font-semibold">{quantity}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("dialogs.gradingCostSummary.perOneTimes", {
                  count: quantity,
                  perOne: perOneStr,
                })}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{t("dialogs.sendingDate")}</p>
                <p className="text-sm font-semibold">{sendingDate || emDash}</p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{t("dialogs.gradingCostSummary.totalCost")}</p>
                <p className="text-sm font-semibold">{moneyHKD(total)}</p>
              </div>
              {submitError ? (
                <p className="mt-2 text-sm text-destructive">{submitError}</p>
              ) : null}
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (onBack) onBack()
                else onOpenChange(false)
              }}
              disabled={submitting}
            >
              {t("dialogs.back")}
            </Button>
            <Button type="button" onClick={handleDone} disabled={submitting}>
              {t("dialogs.done")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
