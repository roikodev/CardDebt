import { Button } from "@/components/ui/button"
import { CollapsibleHeader, useCollapsibleHeader } from "@/components/CollapsibleHeader"
import { GradedChip } from "@/components/GradedChip"
import { GradingChip } from "@/components/GradingChip"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

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
  derived?: boolean
  graded: boolean
  grading: boolean
  collection_item_id: string
  collection_base: CollectionBase | null
  user_collection_grading?:
    | { provider: string; grade: number }
    | { provider: string; grade: number }[]
    | null
}

type CollectionGroup = {
  key: string
  collection_item_id: string
  graded: boolean
  count: number
  base: CollectionBase | null
  gradedLevelCounts: Record<string, { provider: string; grade: number; count: number }>
  gradingCount: number
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
  const gradingCount = group.gradingCount
  const gradedLevels = Object.values(group.gradedLevelCounts).sort((a, b) => b.grade - a.grade)
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
      <div className="flex min-h-[92px] flex-col gap-1 p-3">
        <div className="min-h-5">
          {(gradedLevels.length > 0 || gradingCount > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {gradedLevels.map((lvl) => (
                <GradedChip
                  key={`${lvl.provider}-${lvl.grade}`}
                  provider={lvl.provider}
                  grade={lvl.grade}
                  count={lvl.count}
                  tone="light"
                />
              ))}
              {gradingCount > 0 && <GradingChip count={gradingCount} tone="light" />}
            </div>
          )}
        </div>
        <p className="line-clamp-2 text-sm font-medium leading-snug">{name}</p>
        <p className="text-xs text-muted-foreground">{meta || "—"}</p>
      </div>
    </Link>
  )
}

function EmptyCollectionCard({
  base,
  workerOrigin,
}: {
  base: CollectionBase
  workerOrigin?: string
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const filePath = base.image_cloud_path
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
      } catch {
        /* ignore */
      }
    }
    fetchUrl()
    return () => {
      isMounted = false
    }
  }, [base.image_cloud_path, workerOrigin])

  const name = base.name ?? "Untitled"
  const meta = [base.game_title, base.card_no].filter(Boolean).join(" · ")

  return (
    <Link
      to="/user/my-collection/$collection_item_id"
      params={{ collection_item_id: base.id }}
      search={{ graded: false }}
      className="group relative block cursor-pointer overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="aspect-[4/3] w-full bg-muted/30">
        {imgUrl ? (
          <img src={imgUrl} alt={name} className="h-full w-full object-cover object-left-top" loading="lazy" />
        ) : (
          <div className="h-full w-full animate-pulse bg-muted/50" />
        )}
      </div>
      <div className="flex min-h-[92px] flex-col gap-1 p-3">
        <div className="min-h-5">
          <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-semibold leading-none text-foreground">
            Empty
          </span>
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
  const [groupFilter, setGroupFilter] = useState<"all" | "graded" | "raw" | "empty">("all")
  const [emptyLoading, setEmptyLoading] = useState(false)
  const [emptyBases, setEmptyBases] = useState<CollectionBase[]>([])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const { headerRef, headerHeight, onScroll, animatedStyle } = useCollapsibleHeader()

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from("user_collection")
        .select(`
          id, derived, graded, grading, collection_item_id, 
          collection_base:collection_item_id ( id, game_title, card_no, name, image_cloud_path ), 
          user_collection_grading:user_collection_grading ( provider, grade )
        `)
        .eq("user_id", user.id)
        .eq("derived", false)
        .order("created_at", { ascending: false })

      const rows = data as unknown as UserCollectionRow[]
      const map = new Map<string, CollectionGroup>()
      rows?.forEach(r => {
        const key = `${r.collection_item_id}:${r.graded ? "1" : "0"}`
        const rawGrading = r.user_collection_grading
        const gradingDetail = Array.isArray(rawGrading) ? (rawGrading[0] ?? null) : (rawGrading ?? null)
        const levelKey = gradingDetail ? `${gradingDetail.provider}:${gradingDetail.grade}` : null
        const isGrading = Boolean(r.grading)
        let target = map.get(key)
        if (!target) {
          target = {
            key,
            collection_item_id: r.collection_item_id,
            graded: r.graded,
            count: 0,
            base: r.collection_base,
            gradedLevelCounts: {},
            gradingCount: 0,
          }
          map.set(key, target)
        }

        target.count++
        if (isGrading) target.gradingCount++
        if (r.graded && gradingDetail && levelKey) {
          const current = target.gradedLevelCounts[levelKey]
          target.gradedLevelCounts[levelKey] = current
            ? { ...current, count: current.count + 1 }
            : { provider: gradingDetail.provider, grade: gradingDetail.grade, count: 1 }
        }
      })
      setGroups(Array.from(map.values()))
      setLoading(false)
    })()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    if (groupFilter !== "empty") return

    setEmptyLoading(true)
    ;(async () => {
      const ownedRes = await supabase
        .from("user_collection")
        .select("collection_item_id")
        .eq("user_id", user.id)

      if (ownedRes.error) {
        setEmptyBases([])
        setEmptyLoading(false)
        return
      }

      const ownedIds = new Set(
        (ownedRes.data ?? [])
          .map((r) => (r as { collection_item_id: string | null }).collection_item_id)
          .filter((v): v is string => Boolean(v))
      )

      const baseRes = await supabase
        .from("collection_base")
        .select("id, game_title, card_no, name, image_cloud_path")
        .order("name", { ascending: true })

      if (baseRes.error) {
        setEmptyBases([])
        setEmptyLoading(false)
        return
      }

      const allBases = (baseRes.data ?? []) as CollectionBase[]
      setEmptyBases(allBases.filter((b) => !ownedIds.has(b.id)))
      setEmptyLoading(false)
    })()
  }, [groupFilter, user?.id])

  const gradedGroups = useMemo(
    () => groups.filter((g) => g.graded).sort((a, b) => b.count - a.count),
    [groups]
  )
  const rawCardGroups = useMemo(
    () => groups.filter((g) => !g.graded).sort((a, b) => b.count - a.count),
    [groups]
  )

  return (
    <main className="flex h-screen max-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col">
        <CollapsibleHeader
          headerRef={headerRef}
          height={headerHeight}
          animatedStyle={animatedStyle}
          left={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Back to Dashboard"
              onClick={() => navigate({ to: "/user/dashboard" })}
            >
              <ArrowLeft className="size-5" />
            </Button>
          }
          title={<h1 className="text-xl font-semibold">My Collection</h1>}
          right={
            <>
              <Button
                type="button"
                size="sm"
                variant={groupFilter === "all" ? "default" : "outline"}
                onClick={() => setGroupFilter("all")}
              >
                All
              </Button>
              <Button
                type="button"
                size="sm"
                variant={groupFilter === "graded" ? "default" : "outline"}
                onClick={() => setGroupFilter("graded")}
              >
                Graded
              </Button>
              <Button
                type="button"
                size="sm"
                variant={groupFilter === "raw" ? "default" : "outline"}
                onClick={() => setGroupFilter("raw")}
              >
                Raw
              </Button>
              <Button
                type="button"
                size="sm"
                variant={groupFilter === "empty" ? "default" : "outline"}
                onClick={() => setGroupFilter("empty")}
              >
                Empty
              </Button>
            </>
          }
        />

        {/* This container now grows to fill the remaining space and handles scrolling */}
        <div
          ref={scrollRef}
          className="scrollbar-hide flex-1 overflow-y-auto overflow-x-hidden rounded-xl px-4 pb-4 [&::-webkit-scrollbar]:hidden"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingTop: headerHeight,
          }}
          onScroll={(e) => {
            const el = e.currentTarget
            onScroll(el.scrollTop)
          }}
        >
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {[...Array(12)].map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : (
            <div className="space-y-6">
              {groupFilter === "empty" ? (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold">Empty</h2>
                    <span className="text-sm text-muted-foreground">{emptyBases.length} items</span>
                  </div>
                  {emptyLoading ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {[...Array(12)].map((_, i) => (
                        <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
                      ))}
                    </div>
                  ) : emptyBases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No empty items.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {emptyBases.map((b) => (
                        <EmptyCollectionCard key={b.id} base={b} workerOrigin={workerOrigin} />
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {groupFilter !== "raw" && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold">Graded</h2>
                    <span className="text-sm text-muted-foreground">{gradedGroups.length} groups</span>
                  </div>
                  {gradedGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No graded groups.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {gradedGroups.map((g) => (
                        <CollectionCard key={g.key} group={g} workerOrigin={workerOrigin} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {groupFilter !== "graded" && (
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold">Raw</h2>
                    <span className="text-sm text-muted-foreground">{rawCardGroups.length} groups</span>
                  </div>
                  {rawCardGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No raw card groups.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {rawCardGroups.map((g) => (
                        <CollectionCard key={g.key} group={g} workerOrigin={workerOrigin} />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}