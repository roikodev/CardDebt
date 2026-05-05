import { useEffect, useMemo, useRef, useState } from "react"

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
import { toast } from "sonner"

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

function moneyHKD(n: number): string {
  if (!Number.isFinite(n)) return "HKD$—"
  return `HKD$${n.toFixed(2)}`
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
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined
  const [source, setSource] = useState<SourceBase | null>(null)
  const [sourceImg, setSourceImg] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const derivedRows = useMemo(() => {
    return targets.map((t) => {
      const per1 = sumCosts(perItemCosts[t.id])
      return { ...t, per1 }
    })
  }, [perItemCosts, targets])

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
      setSaveError("You are not signed in.")
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
      setSaveError("Not enough available items to derive from.")
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
        setSaveError("Missing source image for a Create New item.")
        setSaving(false)
        return
      }
      if (!accessToken) {
        setSaveError("Missing session token for image upload.")
        setSaving(false)
        return
      }
      const base = (workerOrigin ?? "").replace(/\/+$/, "")
      if (!base) {
        setSaveError("Missing Worker origin for image upload.")
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
        setSaveError(`Image upload failed: could not reach Worker (${base}).`)
        setSaving(false)
        return
      }

      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => "")
        setSaveError(`Image upload failed (${uploadRes.status}). ${text}`.trim())
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
        setSaveError(cbRes.error?.message ?? "Failed to create collection item.")
        setSaving(false)
        return
      }

      derivedBaseIdByDraftId.set(d.id, cbRes.data.id)
    }

    for (const d of drafts) {
      if (d.mode !== "choose_from_base") continue
      const baseId = d.selectedBase?.id ?? null
      if (!baseId) {
        setSaveError("Missing selected base item for a Choose from Card Base entry.")
        setSaving(false)
        return
      }
      derivedBaseIdByDraftId.set(d.id, baseId)
    }

    const activeDrafts = drafts.filter((d) => d.mode === "choose_from_base" || d.mode === "create_new")
    if (!activeDrafts.length) {
      setSaveError("No derived items to create.")
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
        setSaveError(ucInsertRes.error?.message ?? "Failed to create derived collection items.")
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
        setSaveError(mapRes.error?.message ?? "Failed to create derived mapping records.")
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
    toast.success("Saved successfully", { duration: 5000 })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,46rem)] min-w-0 overflow-x-hidden sm:max-w-lg p-0">
        <DialogBody className="min-w-0 px-4 pt-4 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>Derive summary</DialogTitle>
            <DialogDescription>Review the derived items and costs.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 min-w-0 space-y-3">
            <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">Source</p>
              <div className="mt-2 flex min-w-0 items-start gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted/30">
                  {sourceImg ? (
                    <img
                      src={sourceImg}
                      alt={source?.name ?? "Source item"}
                      className="h-full w-full object-cover object-left-top"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-muted/50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium leading-snug">{source?.name ?? "—"}</p>
                  <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground">
                    {[source?.game_title, source?.card_no].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    graded: {String(sourceGraded)} · current qty: {sourceQuantity}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-semibold">Derive</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 text-muted-foreground">
                  consume {sets} source item{sets === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold leading-snug">Derived items (cost per 1)</p>
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

                      {(perItemCosts[r.id] ?? []).length ? (
                        <div className="mt-3 min-w-0 space-y-2 border-t pt-3">
                          {(perItemCosts[r.id] ?? []).map((c) => (
                            <div
                              key={c.id}
                              className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-medium leading-snug">
                                  {c.type}{" "}
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
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">No costs for this item.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No derived items.</p>
              )}

            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border bg-card p-3">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold">Total cost</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{moneyHKD(total)}</p>
              </div>
              {saveError ? (
                <p className="mt-2 break-words text-sm text-destructive">{saveError}</p>
              ) : null}
              <div className="mt-3 grid min-w-0 gap-2 text-sm">
                <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Derived items</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {moneyHKD(derivedPer1)} per 1 × {sets} set{sets === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums sm:text-right">{moneyHKD(derivedTotal)}</p>
                </div>

                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                  <p className="font-semibold">Total</p>
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
            Back
          </Button>
          <Button type="button" className="w-full min-w-0 sm:w-auto" onClick={handleDone} disabled={saving}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

