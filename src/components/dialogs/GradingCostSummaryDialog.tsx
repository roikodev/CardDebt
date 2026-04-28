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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionItemId: string
  sourceQuantity: number
  quantity: number
  costs: CostEntry[]
  onDone?: () => void
}

function moneyHKD(n: number): string {
  if (!Number.isFinite(n)) return "HKD$—"
  return `HKD$${n.toFixed(2)}`
}

function sumCosts(costs: CostEntry[] | undefined): number {
  if (!costs?.length) return 0
  return costs.reduce((sum, c) => sum + (Number(c.costHKD) || 0), 0)
}

export function GradingCostSummaryDialog({
  open,
  onOpenChange,
  collectionItemId,
  sourceQuantity,
  quantity,
  costs,
  onDone,
}: Props) {
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined
  const [source, setSource] = useState<SourceBase | null>(null)
  const [sourceImg, setSourceImg] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const per1 = useMemo(() => sumCosts(costs), [costs])
  const total = useMemo(() => per1 * (Number(quantity) || 0), [per1, quantity])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,46rem)] overflow-y-auto sm:max-w-lg p-0">
        <div className="p-5 sm:p-6">
          <DialogHeader className="px-0">
            <DialogTitle>Grading cost summary</DialogTitle>
            <DialogDescription>Review quantity and costs before finishing.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">Collection item</p>
              <div className="mt-2 flex items-start gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-lg border bg-muted/30">
                  {sourceImg ? (
                    <img
                      src={sourceImg}
                      alt={source?.name ?? "Collection item"}
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
                    current qty: {sourceQuantity}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">Costs (per 1)</p>
              {costs.length ? (
                <div className="mt-3 space-y-2">
                  {costs.map((c) => (
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
                <p className="mt-2 text-sm text-muted-foreground">No costs.</p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Quantity</p>
                <p className="text-sm font-semibold">{quantity}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {moneyHKD(per1)} per 1 × {quantity} item{quantity === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Total cost</p>
                <p className="text-sm font-semibold">{moneyHKD(total)}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                onDone?.()
                onOpenChange(false)
              }}
            >
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

