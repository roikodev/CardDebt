import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

// --- Types ---
type CollectionBase = {
  id: string
  game_title: string | null
  card_no: string | null
  name: string | null
  image_cloud_path: string | null
}

type UserCollectionRow = {
  id: string
  graded: boolean
  collection_item_id: string
  collection_base: CollectionBase | null
  user_collection_grading?: { provider: string; grade: number } | null
}

type CollectionGroup = {
  key: string
  collection_item_id: string
  graded: boolean
  count: number
  base: CollectionBase | null
  grading: { provider: string; grade: number } | null
}

// --- Sub-Component: Individual Card Thumbnail ---
function CollectionCard({ 
  group, 
  workerOrigin 
}: { 
  group: CollectionGroup, 
  workerOrigin?: string 
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  
  useEffect(() => {
    let isMounted = true
    const filePath = group.base?.image_cloud_path
    if (!filePath || !workerOrigin) return

    const fetchUrl = async () => {
      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token
      if (!token) return

      try {
        const baseUrl = workerOrigin.replace(/\/+$/, "")
        const url = `${baseUrl}/signed?file=${encodeURIComponent(filePath)}&ttl=300`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (isMounted && data.url) setImgUrl(data.url)
      } catch { /* ignore */ }
    }
    fetchUrl()
    return () => { isMounted = false }
  }, [group.base?.image_cloud_path, workerOrigin])

  const name = group.base?.name ?? "Untitled"
  const meta = [group.base?.game_title, group.base?.card_no].filter(Boolean).join(" · ")
  const gradingLabel = group.grading ? `${group.grading.provider} ${group.grading.grade}` : null
  const isPsa10 = group.grading?.provider === "PSA" && Number(group.grading.grade) === 10
  const isPsa9 = group.grading?.provider === "PSA" && Number(group.grading.grade) === 9

  return (
    <Link
      to="/user/my-collection/$collection_item_id"
      params={{ collection_item_id: group.collection_item_id }}
      search={{ graded: group.graded }}
      className="group relative block cursor-pointer overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
        {group.count}
      </div>
      <div className="aspect-[4/3] w-full bg-muted/30">
        {imgUrl ? (
          <img src={imgUrl} alt={name} className="h-full w-full object-cover object-left-top" loading="lazy" />
        ) : (
          <div className="h-full w-full animate-pulse bg-muted/50" />
        )}
      </div>
      <div className="flex h-[88px] flex-col gap-1 p-3">
        <div className="h-5">
          {gradingLabel && (
            <div className="flex items-center justify-start">
              <span className={[
                "shine-chip inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none",
                isPsa10 ? "shine-chip-gold border-amber-300/70 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 text-amber-950 shadow-sm" : 
                isPsa9 ? "border-zinc-300/70 bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-100 text-zinc-900 shadow-sm" : 
                "border-border bg-muted/50 text-foreground"
              ].join(" ")}>
                {gradingLabel}
              </span>
            </div>
          )}
        </div>
        <p className="line-clamp-2 text-sm font-medium leading-snug">{name}</p>
        <p className="text-xs text-muted-foreground">{meta || "—"}</p>
      </div>
    </Link>
  )
}

// --- Main Component ---
export function MyCollection() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined

  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<CollectionGroup[]>([])
  const [cols, setCols] = useState(2)
  const [rowHeight, setRowHeight] = useState(280)
  
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      if (w >= 1280) { setCols(6); setRowHeight(240); }
      else if (w >= 1024) { setCols(5); setRowHeight(250); }
      else if (w >= 768) { setCols(4); setRowHeight(260); }
      else if (w >= 640) { setCols(3); setRowHeight(270); }
      else { setCols(2); setRowHeight(280); }
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from("user_collection")
        .select(`
          id, graded, collection_item_id, 
          collection_base:collection_item_id ( id, game_title, card_no, name, image_cloud_path ), 
          user_collection_grading:user_collection_grading ( provider, grade )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      const rows = data as unknown as UserCollectionRow[]
      const map = new Map<string, CollectionGroup>()
      rows?.forEach(r => {
        const key = `${r.collection_item_id}:${r.graded ? "1" : "0"}`
        const existing = map.get(key)
        if (existing) existing.count++
        else map.set(key, {
          key, collection_item_id: r.collection_item_id, graded: r.graded, count: 1,
          base: r.collection_base, grading: r.graded && r.user_collection_grading ? r.user_collection_grading : null,
        })
      })
      setGroups(Array.from(map.values()))
      setLoading(false)
    })()
  }, [user?.id])

  const rowCount = Math.ceil(groups.length / cols)
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  })

  return (
    <main className="flex h-screen max-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-6">
        <header className="flex shrink-0 items-center gap-4 pb-6">
          <Button variant="ghost" className="gap-2" onClick={() => navigate({ to: "/user/dashboard" })}>
            <ArrowLeft className="size-5" />
            Dashboard
          </Button>
          <h1 className="text-xl font-semibold">My Collection</h1>
        </header>

        {/* This container now grows to fill the remaining space and handles scrolling */}
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto overflow-x-hidden rounded-xl scrollbar-hide"
        >
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {[...Array(12)].map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : (
            <div
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const startIndex = vRow.index * cols
                const rowItems = groups.slice(startIndex, startIndex + cols)

                return (
                  <div
                    key={vRow.key}
                    className="absolute left-0 top-0 grid w-full gap-4"
                    style={{
                      height: `${vRow.size}px`,
                      transform: `translateY(${vRow.start}px)`,
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowItems.map((g) => (
                      <CollectionCard key={g.key} group={g} workerOrigin={workerOrigin} />
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}