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

export type CollectionBaseRow = {
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
  onSelect?: (item: CollectionBaseRow) => void
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

export function CardBaseDialog({
  open,
  onOpenChange,
  onSelect,
}: CardBaseDialogProps) {
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

    const update = () => {
      if (typeof window === "undefined") return
      const w = window.innerWidth
      // Breakpoints: xs < 640, sm >= 640, md >= 768, lg >= 1024, xl >= 1280
      if (w >= 1280) setCols(6) // xl
      else if (w >= 1024) setCols(5) // lg
      else if (w >= 768) setCols(4) // md
      else if (w >= 640) setCols(3) // sm
      else setCols(2) // xs
    }

    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
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

      // Always show list even if we can't load images.
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

  const gridTemplateColumns = useMemo(() => `repeat(${cols}, minmax(0, 1fr))`, [cols])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90dvh,46rem)] min-h-[30rem] flex-col gap-3 overflow-hidden sm:max-w-3xl"
      >
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
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonTile key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items found.</p>
        ) : (
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-auto"
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
                    className="absolute left-0 top-0 grid w-full gap-3"
                    style={{
                      transform: `translateY(${vRow.start}px)`,
                      gridTemplateColumns,
                    }}
                  >
                    {rowItems.map((row) => {
                      const title = formatTitle(row)
                      const imgUrl = imageUrls[row.id]
                      return (
                        <button
                          key={row.id}
                          type="button"
                          className="group cursor-pointer overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => {
                            onSelect?.(row)
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

