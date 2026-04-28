import { useEffect, useMemo, useRef, useState } from "react"

import {
  Dialog,
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

type SourceBase = {
  id: string
  game_title: string | null
  card_no: string | null
  name: string | null
  image_cloud_path: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sets: number
  sourceQuantity: number
  sourceCollectionItemId: string
  sourceGraded: boolean
  targets: DerivedItemCostTarget[]
  generalCosts?: CostEntry[]
  perItemCosts: Record<string, CostEntry[]>
}

function moneyHKD(n: number): string {
  if (!Number.isFinite(n)) return "HKD$—"
  return `HKD$${n.toFixed(2)}`
}

function sumCosts(costs: CostEntry[] | undefined): number {
  if (!costs?.length) return 0
  return costs.reduce((sum, c) => sum + (Number(c.costHKD) || 0), 0)
}

export function DeriveSummaryDialog({
  open,
  onOpenChange,
  sets,
  sourceQuantity,
  sourceCollectionItemId,
  sourceGraded,
  targets,
  generalCosts: _generalCosts,
  perItemCosts,
}: Props) {
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined
  const [source, setSource] = useState<SourceBase | null>(null)
  const [sourceImg, setSourceImg] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,46rem)] overflow-y-auto sm:max-w-lg p-0">
        <div className="p-5 sm:p-6">
          <DialogHeader className="px-0">
            <DialogTitle>Derive summary</DialogTitle>
            <DialogDescription>Review the derived items and costs.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">Source</p>
              <div className="mt-2 flex items-start gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-lg border bg-muted/30">
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
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{source?.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[source?.game_title, source?.card_no].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    graded: {String(sourceGraded)} · current qty: {sourceQuantity}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">Derive</span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">
                  consume {sets} source item{sets === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">Derived items (cost per 1)</p>
              {derivedRows.length ? (
                <div className="mt-3 space-y-2">
                  {derivedRows.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
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
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{r.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold">
                          {moneyHKD(r.per1)}
                        </div>
                      </div>

                      {(perItemCosts[r.id] ?? []).length ? (
                        <div className="mt-3 space-y-2 border-t pt-3">
                          {(perItemCosts[r.id] ?? []).map((c) => (
                            <div
                              key={c.id}
                              className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {c.type}{" "}
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
                        <p className="mt-2 text-sm text-muted-foreground">No costs for this item.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No derived items.</p>
              )}

            </div>

            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Total cost</p>
                <p className="text-sm font-semibold">{moneyHKD(total)}</p>
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">Derived items</p>
                    <p className="text-xs text-muted-foreground">
                      {moneyHKD(derivedPer1)} per 1 × {sets} set{sets === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">{moneyHKD(derivedTotal)}</p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                  <p className="font-semibold">Total</p>
                  <p className="font-semibold">{moneyHKD(total)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Back
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

