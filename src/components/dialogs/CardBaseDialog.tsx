import { useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"

type CollectionBaseRow = {
  id: string
  game_title: string | null
  card_no: string | null
  name: string | null
  image_cloud_path: string | null
  created_at?: string
}

type CardBaseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function SkeletonTile() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="aspect-[4/3] w-full animate-pulse bg-muted/50" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-10/12 animate-pulse rounded bg-muted/50" />
        <div className="h-3 w-8/12 animate-pulse rounded bg-muted/50" />
      </div>
    </div>
  )
}

function formatTitle(row: CollectionBaseRow): string {
  const parts: string[] = []
  if (row.game_title) parts.push(row.game_title)
  if (row.card_no) parts.push(row.card_no)
  if (row.name) parts.push(row.name)
  return parts.join(" · ") || "Untitled"
}

export function CardBaseDialog({ open, onOpenChange }: CardBaseDialogProps) {
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined

  const [items, setItems] = useState<CollectionBaseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [cols, setCols] = useState(2)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const hasWorker = useMemo(() => Boolean(workerOrigin?.trim()), [workerOrigin])

  useEffect(() => {
    if (!open) return
    const el = scrollRef.current
    if (!el) return

    const update = () => {
      const w = el.clientWidth
      // Match Tailwind breakpoints used by the grid (sm=640, md=768)
      if (w >= 768) setCols(4)
      else if (w >= 640) setCols(3)
      else setCols(2)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  useEffect(() => {
    if (!open) return

    setError(null)
    setLoading(true)
    setItems([])
    setImageUrls({})

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const { signal } = abortRef.current

    ;(async () => {
      const sessionRes = await supabase.auth.getSession()
      const session = sessionRes.data.session
      const userId = session?.user?.id
      const accessToken = session?.access_token

      if (!userId || !accessToken) {
        setError("Not signed in.")
        setLoading(false)
        return
      }

      const listRes = await supabase
        .from("collection_base")
        .select("id, game_title, card_no, name, image_cloud_path, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)

      if (signal.aborted) return

      if (listRes.error) {
        setError(listRes.error.message)
        setLoading(false)
        return
      }

      const rows = (listRes.data ?? []) as CollectionBaseRow[]
      setItems(rows)
      setLoading(false)

      if (!hasWorker) return

      const base = workerOrigin!.replace(/\/+$/, "")

      // Fetch signed URLs (Worker) using Authorization header.
      await Promise.all(
        rows.map(async (row) => {
          if (!row.image_cloud_path) return
          try {
            const url = `${base}/signed?file=${encodeURIComponent(
              row.image_cloud_path
            )}&ttl=300`
            const res = await fetch(url, {
              method: "GET",
              headers: { Authorization: `Bearer ${accessToken}` },
              signal,
            })
            if (!res.ok) return
            const data = (await res.json()) as { url?: string }
            if (!data.url) return
            setImageUrls((prev) => ({ ...prev, [row.id]: data.url! }))
          } catch {
            // Ignore per-item image errors.
          }
        })
      )
    })()

    return () => {
      abortRef.current?.abort()
    }
  }, [hasWorker, open, workerOrigin])

  useEffect(() => {
    if (open) return
    abortRef.current?.abort()
    abortRef.current = null
    setItems([])
    setImageUrls({})
  }, [open])

  const rowCount = useMemo(() => Math.ceil(items.length / cols), [cols, items.length])
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 220,
    overscan: 4,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-h-[36rem] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose from my Card Base</DialogTitle>
          <DialogDescription>
            Select an item from your collection base.
          </DialogDescription>
        </DialogHeader>

        {!hasWorker ? (
          <p className="text-sm text-muted-foreground">
            Missing <code>VITE_CF_WORKER_ORIGIN</code>. Unable to load cloud images.
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonTile key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items found.</p>
        ) : (
          <div
            ref={scrollRef}
            className="max-h-[min(70dvh,40rem)] overflow-auto pr-1"
          >
            <div
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const startIndex = vRow.index * cols
                const rowItems = items.slice(startIndex, startIndex + cols)
                return (
                  <div
                    key={vRow.key}
                    className="absolute left-0 top-0 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
                    style={{ transform: `translateY(${vRow.start}px)` }}
                  >
                    {rowItems.map((row) => {
                      const title = formatTitle(row)
                      const imgUrl = imageUrls[row.id]
                      return (
                        <button
                          key={row.id}
                          type="button"
                          className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => {
                            // TODO: return selected item to Buy flow
                            onOpenChange(false)
                          }}
                        >
                          <div className="aspect-[4/3] w-full bg-muted/30">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={title}
                                className="h-full w-full object-cover object-left-top"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-full w-full animate-pulse bg-muted/50" />
                            )}
                          </div>
                          <div className="space-y-1 p-3">
                            <p className="line-clamp-2 text-sm font-medium leading-snug">
                              {row.name ?? "Untitled"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.game_title ?? "—"}
                              {row.card_no ? ` · ${row.card_no}` : ""}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                    {rowItems.length < cols
                      ? Array.from({ length: cols - rowItems.length }).map((_, i) => (
                          <div key={`spacer-${vRow.key}-${i}`} />
                        ))
                      : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

