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
import type { DerivedItemCostTarget, CostEntry } from "@/components/dialogs/DerivedItemCostDialog"
import { ArrowRight } from "lucide-react"
import { parseEntryPrice } from "@/lib/entryPrice"
import { toastSaved } from "@/lib/toastI18n"

type Provider = "PSA"
type DeriveMode = "create_new" | "choose_from_base"

type SourceBase = {
  id: string
  game_title: string | null
  card_no: string | null
  name: string | null
  image_cloud_path: string | null
}

type Draft = {
  id: string
  mode: DeriveMode | null
  entryPrice: string
  selectedBase: { id: string } | null
  chooseFromBase: { graded: boolean; provider: Provider; grade: string }
  createNew: {
    sourceImage: File | null
    gameTitle: string | null
    category: "Card" | "Product"
    cardNo: string
    name: string
    graded: boolean
    provider: Provider
    grade: string
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sets: number
  sourceQuantity: number
  sourceCollectionItemId: string
  sourceGraded: boolean
  sourceUserCollectionIds?: string[]
  drafts: Draft[]
  targets: DerivedItemCostTarget[]
  generalCosts?: CostEntry[]
  perItemCosts: Record<string, CostEntry[]>
  onSubmitted?: () => void
  onBack?: () => void
}

type CostType = "Grading" | "Postal" | "Other"

function sumCosts(costs: CostEntry[] | undefined): number {
  if (!costs?.length) return 0
  return costs.reduce((sum, c) => sum + (Number(c.costHKD) || 0), 0)
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random())
}

export function DeriveSummaryDialog({
  open,
  onOpenChange,
  sets,
  sourceQuantity,
  sourceCollectionItemId,
  sourceGraded,
  sourceUserCollectionIds,
  drafts,
  targets,
  generalCosts: _generalCosts,
  perItemCosts,
  onSubmitted,
  onBack,
}: Props) {
  const { t } = useTranslation()
  const emDash = t("common.emDash")
  const moneyHKD = (n: number) => {
    if (!Number.isFinite(n)) return `HKD$${emDash}`
    return `HKD$${n.toFixed(2)}`
  }
  const costTypeLabel = (type: CostType) =>
    type === "Grading"
      ? t("dialogs.costType.grading")
      : type === "Postal"
        ? t("dialogs.costType.postal")
        : t("dialogs.costType.other")

  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined
  const [source, setSource] = useState<SourceBase | null>(null)
  const [sourceImg, setSourceImg] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const entryPriceByDraftId = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of drafts) {
      if (d.mode !== "choose_from_base" && d.mode !== "create_new") continue
      const parsed = parseEntryPrice(d.entryPrice)
      m.set(d.id, Number.isNaN(parsed) ? 0 : parsed)
    }
    return m
  }, [drafts])

  const derivedRows = useMemo(() => {
    return targets.map((target) => {
      const entryPrice = entryPriceByDraftId.get(target.id) ?? 0
      const miscPer1 = sumCosts(perItemCosts[target.id])
      return { ...target, entryPrice, miscPer1, per1: entryPrice + miscPer1 }
    })
  }, [entryPriceByDraftId, perItemCosts, targets])

  const derivedPer1 = useMemo(
    () => derivedRows.reduce((sum, r) => sum + r.per1, 0),
    [derivedRows]
  )
  const derivedTotal = useMemo(() => derivedPer1 * (Number(sets) || 0), [derivedPer1, sets])
  const total = useMemo(() => derivedTotal, [derivedTotal])

  useEffect(() => {
    if (!open) return
    setSource(null)
    setSourceImg(null)
    setSaving(false)
    setSaveError(null)
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    ;(async () => {
      const itemRes = await supabase
        .from("collection_base")
        .select("id, game_title, card_no, name, image_cloud_path")
        .eq("id", sourceCollectionItemId)
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
  }, [open, sourceCollectionItemId, workerOrigin])

  async function handleDone() {
    if (saving) return
    setSaving(true)
    setSaveError(null)

    const setsInt = Math.max(0, Math.trunc(Number(sets) || 0))
    if (!setsInt) {
      setSaving(false)
      return
    }

    const userRes = await supabase.auth.getUser()
    const userId = userRes.data.user?.id ?? null
    if (!userId) {
      setSaveError(t("dialogs.notSignedIn"))
      setSaving(false)
      return
    }

    let srcIds: string[] = []
    if (sourceUserCollectionIds?.length) {
      srcIds = [...new Set(sourceUserCollectionIds)].slice(0, setsInt)
    } else {
      const srcRes = await supabase
        .from("user_collection")
        .select("id, created_at")
        .eq("user_id", userId)
        .eq("collection_item_id", sourceCollectionItemId)
        .eq("graded", sourceGraded)
        .eq("derived", false)
        .eq("grading", false)
        .eq("deleted", false)
        .order("created_at", { ascending: true })
        .limit(setsInt)

      if (srcRes.error) {
        setSaveError(srcRes.error.message)
        setSaving(false)
        return
      }

      srcIds = (srcRes.data ?? [])
        .map((r) => (r as { id: string }).id)
        .filter((v): v is string => Boolean(v))
    }

    if (srcIds.length) {
      const validateRes = await supabase
        .from("user_collection")
        .select("id")
        .eq("user_id", userId)
        .in("id", srcIds)
        .eq("collection_item_id", sourceCollectionItemId)
        .eq("graded", sourceGraded)
        .eq("derived", false)
        .eq("grading", false)
        .eq("deleted", false)

      if (validateRes.error) {
        setSaveError(validateRes.error.message)
        setSaving(false)
        return
      }

      const validIds = new Set(
        (validateRes.data ?? [])
          .map((r) => (r as { id: string }).id)
          .filter((v): v is string => Boolean(v))
      )
      srcIds = srcIds.filter((id) => validIds.has(id))
    }

    if (srcIds.length < setsInt) {
      setSaveError(t("dialogs.deriveSummary.notEnoughItems"))
      setSaving(false)
      return
    }

    const updRes = await supabase
      .from("user_collection")
      .update({ derived: true })
      .in("id", srcIds)
      .eq("deleted", false)
    if (updRes.error) {
      setSaveError(updRes.error.message)
      setSaving(false)
      return
    }

    const sessionRes = await supabase.auth.getSession()
    const accessToken = sessionRes.data.session?.access_token ?? null

    const derivedBaseIdByDraftId = new Map<string, string>()

    const createNewDrafts = drafts.filter((d) => d.mode === "create_new")
    for (const d of createNewDrafts) {
      const file = d.createNew.sourceImage
      if (!file) {
        setSaveError(t("dialogs.deriveSummary.missingSourceImage"))
        setSaving(false)
        return
      }
      if (!accessToken) {
        setSaveError(t("dialogs.deriveSummary.missingSession"))
        setSaving(false)
        return
      }
      const base = (workerOrigin ?? "").replace(/\/+$/, "")
      if (!base) {
        setSaveError(t("dialogs.deriveSummary.missingWorker"))
        setSaving(false)
        return
      }

      const extRaw = file.name.split(".").pop() ?? ""
      const ext = extRaw.trim().toLowerCase() || "jpg"
      const imageName =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now())
      const imagePath = `${userId}/${imageName}.${ext}`

      const uploadUrl = `${base}/?file=${encodeURIComponent(imagePath)}`
      let uploadRes: Response
      try {
        uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        })
      } catch {
        setSaveError(t("dialogs.editCollection.imageUploadReach", { base }))
        setSaving(false)
        return
      }

      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => "")
        setSaveError(
          t("dialogs.editCollection.imageUploadStatus", {
            status: String(uploadRes.status),
            text,
          }).trim()
        )
        setSaving(false)
        return
      }

      const cbRes = await supabase
        .from("collection_base")
        .insert({
          user_id: userId,
          game_title: d.createNew.gameTitle,
          product_category: d.createNew.category,
          card_no: d.createNew.category === "Card" ? d.createNew.cardNo : null,
          name: d.createNew.name,
          image_cloud_path: imagePath,
        })
        .select("id")
        .single()

      if (cbRes.error || !cbRes.data?.id) {
        setSaveError(cbRes.error?.message ?? t("dialogs.deriveSummary.createBaseFailed"))
        setSaving(false)
        return
      }

      derivedBaseIdByDraftId.set(d.id, cbRes.data.id)
    }

    for (const d of drafts) {
      if (d.mode !== "choose_from_base") continue
      const baseId = d.selectedBase?.id ?? null
      if (!baseId) {
        setSaveError(t("dialogs.deriveSummary.missingBaseItem"))
        setSaving(false)
        return
      }
      derivedBaseIdByDraftId.set(d.id, baseId)
    }

    const activeDrafts = drafts.filter((d) => d.mode === "choose_from_base" || d.mode === "create_new")
    if (!activeDrafts.length) {
      setSaveError(t("dialogs.deriveSummary.noDerivedItems"))
      setSaving(false)
      return
    }

    for (const fromUcId of srcIds) {
      const toInsert = activeDrafts.map((d) => {
        const baseId = derivedBaseIdByDraftId.get(d.id)
        if (!baseId) return null
        const graded = d.mode === "choose_from_base" ? d.chooseFromBase.graded : d.createNew.graded
        const provider = d.mode === "choose_from_base" ? d.chooseFromBase.provider : d.createNew.provider
        const grade = d.mode === "choose_from_base" ? d.chooseFromBase.grade : d.createNew.grade
        return {
          draftId: d.id,
          graded,
          provider,
          grade,
          row: {
            user_id: userId,
            graded,
            derived: false,
            deleted: false,
            collection_item_id: baseId,
            buying_entries_id: null,
            entry_price: entryPriceByDraftId.get(d.id) ?? 0,
          },
        }
      }).filter(Boolean) as Array<{
        draftId: string
        graded: boolean
        provider: Provider
        grade: string
        row: any
      }>

      const ucInsertRes = await supabase
        .from("user_collection")
        .insert(toInsert.map((x) => x.row))
        .select("id")
      if (ucInsertRes.error || !ucInsertRes.data?.length) {
        setSaveError(ucInsertRes.error?.message ?? t("dialogs.deriveSummary.createDerivedFailed"))
        setSaving(false)
        return
      }

      const toUcIds = ucInsertRes.data.map((r) => (r as { id: string }).id)

      const gradingRows: Array<{ user_collection_id: string; provider: Provider; grade: number }> = []
      toInsert.forEach((x, idx) => {
        if (!x.graded) return
        gradingRows.push({
          user_collection_id: toUcIds[idx],
          provider: x.provider,
          grade: Number(x.grade) || 0,
        })
      })

      if (gradingRows.length) {
        const gRes = await supabase.from("user_collection_grading").insert(gradingRows)
        if (gRes.error) {
          setSaveError(gRes.error.message)
          setSaving(false)
          return
        }
      }

      const mapRows = toUcIds.map((toId) => ({
        id: uid(),
        user_id: userId,
        from_user_collection_id: fromUcId,
        to_user_collection_id: toId,
      }))

      const mapRes = await supabase
        .from("user_derived_collection")
        .insert(mapRows)

      if (mapRes.error) {
        setSaveError(mapRes.error?.message ?? t("dialogs.deriveSummary.createMappingFailed"))
        setSaving(false)
        return
      }

      const mapIdByToUcId = new Map<string, string>()
      mapRows.forEach((r) => mapIdByToUcId.set((r as any).to_user_collection_id, (r as any).id))

      const miscEntryRows: any[] = []
      const udcMiscLinkRows: any[] = []
      toInsert.forEach((x, idx) => {
        const toUcId = toUcIds[idx]
        const mapId = mapIdByToUcId.get(toUcId)
        if (!mapId) return
        const costsForDraft = perItemCosts[x.draftId] ?? []
        for (const c of costsForDraft) {
          const miscId = uid()
          miscEntryRows.push({
            id: miscId,
            user_id: userId,
            type: c.type,
            description: c.description,
            price: Number(c.costHKD) || 0,
            date: c.date,
          })

          udcMiscLinkRows.push({
            id: uid(),
            user_id: userId,
            user_derived_collection_id: mapId,
            miscellaneous_entries_id: miscId,
          })
        }
      })

      if (miscEntryRows.length) {
        const miscRes = await supabase.from("miscellaneous_entries").insert(miscEntryRows)
        if (miscRes.error) {
          setSaveError(miscRes.error.message)
          setSaving(false)
          return
        }

        const linkRes = await supabase
          .from("user_derived_collection_miscellaneous")
          .insert(udcMiscLinkRows)
        if (linkRes.error) {
          setSaveError(linkRes.error.message)
          setSaving(false)
          return
        }
      }
    }

    onOpenChange(false)
    onSubmitted?.()
    toastSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,46rem)] min-w-0 overflow-x-hidden sm:max-w-lg p-0">
        <DialogBody className="min-w-0 px-4 pt-4 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>{t("dialogs.deriveSummaryTitle")}</DialogTitle>
            <DialogDescription>{t("dialogs.deriveSummary.description")}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 min-w-0 space-y-3">
            <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">{t("dialogs.deriveSummary.sourceHeading")}</p>
              <div className="mt-2 flex min-w-0 items-start gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted/30">
                  {sourceImg ? (
                    <img
                      src={sourceImg}
                      alt={source?.name ?? t("dialogs.deriveSummary.sourceAlt")}
                      className="h-full w-full object-cover object-left-top"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-muted/50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium leading-snug">{source?.name ?? emDash}</p>
                  <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground">
                    {[source?.game_title, source?.card_no].filter(Boolean).join(" · ") || emDash}
                  </p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {t("dialogs.deriveSummary.sourceLineMeta", {
                      graded: sourceGraded ? t("dialogs.graded") : t("dialogs.raw"),
                      currentQty: t("dialogs.gradingCostSummary.currentQty", {
                        count: sourceQuantity,
                      }),
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-semibold">{t("dialogs.deriveSummary.deriveRowLead")}</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 text-muted-foreground">
                  {t("dialogs.deriveSummary.consumeSource", { count: sets })}
                </span>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold leading-snug">
                {t("dialogs.deriveSummary.derivedItemsCostPerOne")}
              </p>
              {derivedRows.length ? (
                <div className="mt-3 space-y-2">
                  {derivedRows.map((r) => (
                    <div
                      key={r.id}
                      className="min-w-0 overflow-hidden rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-muted/30">
                            {r.imageSrc ? (
                              <img
                                src={r.imageSrc}
                                alt={r.title}
                                className="h-full w-full object-cover object-left-top"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-full w-full animate-pulse bg-muted/50" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-medium leading-snug">{r.title}</p>
                            <p className="break-words text-xs leading-snug text-muted-foreground">{r.subtitle}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-left text-sm font-semibold tabular-nums sm:text-right">
                          {moneyHKD(r.per1)}
                        </div>
                      </div>

                      <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t pt-3 text-sm">
                        <span className="text-muted-foreground">
                          {t("dialogs.deriveSummary.entryPriceLine")}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {moneyHKD(r.entryPrice)}
                        </span>
                      </div>

                      {(perItemCosts[r.id] ?? []).length ? (
                        <div className="mt-3 min-w-0 space-y-2 border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("dialogs.deriveSummary.miscCostsLine")}
                          </p>
                          {(perItemCosts[r.id] ?? []).map((c) => (
                            <div
                              key={c.id}
                              className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-medium leading-snug">
                                  {costTypeLabel(c.type as CostType)}{" "}
                                  <span className="text-xs font-normal text-muted-foreground">
                                    · {c.date}
                                  </span>
                                </p>
                                {c.type === "Other" && c.description?.trim() ? (
                                  <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground">
                                    {c.description.trim()}
                                  </p>
                                ) : null}
                              </div>
                              <p className="shrink-0 text-sm font-semibold tabular-nums sm:text-right">
                                {moneyHKD(Number(c.costHKD) || 0)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("dialogs.deriveSummary.noDerivedItemsInList")}
                </p>
              )}

            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-3">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold">{t("dialogs.deriveSummary.totalLabel")}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{moneyHKD(total)}</p>
              </div>
              {saveError ? (
                <p className="mt-2 break-words text-sm text-destructive">{saveError}</p>
              ) : null}
              <div className="mt-3 grid min-w-0 gap-2 text-sm">
                <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t("dialogs.deriveSummary.derivedItemsSubheading")}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {t("dialogs.deriveSummary.perSetSummary", {
                        count: sets,
                        perOne: moneyHKD(derivedPer1),
                      })}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums sm:text-right">{moneyHKD(derivedTotal)}</p>
                </div>

                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                  <p className="font-semibold">{t("dialogs.deriveSummary.grandTotalLabel")}</p>
                  <p className="shrink-0 font-semibold tabular-nums">{moneyHKD(total)}</p>
                </div>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="gap-2 px-4 pb-5 pt-3 sm:px-6 sm:pb-6">
          <Button
            type="button"
            variant="outline"
            className="w-full min-w-0 sm:w-auto"
            onClick={() => {
              if (onBack) onBack()
              else onOpenChange(false)
            }}
            disabled={saving}
          >
            {t("dialogs.back")}
          </Button>
          <Button type="button" className="w-full min-w-0 sm:w-auto" onClick={handleDone} disabled={saving}>
            {t("dialogs.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

