import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { useNavigate } from "@tanstack/react-router"
import { Route } from "@/routes/user/my-collection/$collection_item_id"
import { ArrowLeft, Sparkles } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { DeriveDialog } from "@/components/dialogs/DeriveDialog"
import { GradingCostDialog } from "../components/dialogs/GradingCostDialog"
import { ItemInfoCard } from "@/components/collection-info/ItemInfoCard"
import { RecordsPanel } from "@/components/collection-info/RecordsPanel"
import type {
  BuyEntry,
  CollectionBase,
  DerivedRecordRow,
  GradingRecordRow,
  MiscCostLine,
  OverviewCollectionRow,
  UserCollectionRow,
} from "@/components/collection-info/types"

function formatMoneyHKD(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return `HKD$${n.toFixed(2)}`
}

export function CollectionInfo() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined

  const { collection_item_id } = Route.useParams()
  const search = Route.useSearch()
  const graded = Boolean(search.graded)

  const [recordsView, setRecordsView] = useState<"purchase" | "derived" | "grading">("purchase")
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [item, setItem] = useState<CollectionBase | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [sourceImagePath, setSourceImagePath] = useState<string | null>(null)
  const [buyEntries, setBuyEntries] = useState<BuyEntry[]>([])
  const [gradedLevelCounts, setGradedLevelCounts] = useState<
    Record<string, { provider: string; grade: number; count: number }>
  >({})
  const [gradingCount, setGradingCount] = useState(0)
  const [derivedLoading, setDerivedLoading] = useState(false)
  const [derivedError, setDerivedError] = useState<string | null>(null)
  const [derivedRecords, setDerivedRecords] = useState<DerivedRecordRow[]>([])
  const [derivedImageUrls, setDerivedImageUrls] = useState<Record<string, string>>({})
  const [derivedImagePaths, setDerivedImagePaths] = useState<Record<string, string>>({})
  const [gradingRecords, setGradingRecords] = useState<GradingRecordRow[]>([])
  const [overviewRows, setOverviewRows] = useState<OverviewCollectionRow[]>([])
  const [deriveOpen, setDeriveOpen] = useState(false)
  const [gradeOpen, setGradeOpen] = useState(false)
  const [sourceQuantity, setSourceQuantity] = useState(0)
  const [availableQuantity, setAvailableQuantity] = useState(0)

  const abortRef = useRef<AbortController | null>(null)

  const title = item?.name ?? "Untitled"
  const overviewCounts = useMemo(() => {
    const available = overviewRows.filter((r) => !r.derived && !r.grading).length
    const grading = overviewRows.filter((r) => !r.derived && r.grading).length
    const derived = overviewRows.filter((r) => r.derived).length
    return { available, grading, derived }
  }, [overviewRows])
  const itemFields = useMemo(() => {
    return [
      { label: "Game Title", value: item?.game_title ?? null },
      { label: "Card Number", value: item?.card_no ?? null },
      { label: "Name", value: item?.name ?? null },
    ].filter((f) => f.value)
  }, [item?.card_no, item?.game_title, item?.name])

  async function refreshSignedUrls(
    pathKeys: Array<{ key: string; path: string | null | undefined }>,
    signal?: AbortSignal
  ) {
    if (!workerOrigin?.trim()) return
    if (!pathKeys.length) return

    const sessionRes = await supabase.auth.getSession()
    const token = sessionRes.data.session?.access_token ?? null
    if (!token) return

    const baseUrl = workerOrigin.replace(/\/+$/, "")

    await Promise.all(
      pathKeys.map(async ({ key, path }) => {
        if (!path) return
        try {
          const res = await fetch(`${baseUrl}/signed?file=${encodeURIComponent(path)}&ttl=300`, {
            headers: { Authorization: `Bearer ${token}` },
            signal,
          })
          if (!res.ok) return
          const data = (await res.json()) as { url?: string }
          if (!data.url) return
          if (key === "source") setImageUrl(data.url)
          else setDerivedImageUrls((prev) => ({ ...prev, [key]: data.url! }))
        } catch {
          // ignore
        }
      })
    )
  }

  async function fetchAll({ soft }: { soft: boolean }) {
    const userId = user?.id
    if (!userId) return

    if (!soft) {
      setLoading(true)
      setError(null)
      setItem(null)
      setImageUrl(null)
      setSourceImagePath(null)
      setBuyEntries([])
      setGradedLevelCounts({})
      setGradingCount(0)
      setDerivedLoading(true)
      setDerivedError(null)
      setDerivedRecords([])
      setDerivedImageUrls({})
      setDerivedImagePaths({})
      setGradingRecords([])
      setOverviewRows([])
      setRecordsView("purchase")
    } else {
      // Keep existing UI; refresh data in background.
      setError(null)
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    ;(async () => {
      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token ?? null

      // Always re-fetch base item (even on soft refresh) so edits reflect immediately.
      const itemRes = await supabase
        .from("collection_base")
        .select("id, game_title, card_no, name, image_cloud_path")
        .eq("id", collection_item_id)
        .single()

      if (signal.aborted) return

      if (itemRes.error) {
        setError(itemRes.error.message)
        setLoading(false)
        return
      }

      const baseItem = itemRes.data as CollectionBase
      setItem(baseItem)
      setSourceImagePath(baseItem?.image_cloud_path ?? null)

      const ucRes = await supabase
        .from("user_collection")
        .select(
          "id, buying_entries_id, grading, user_collection_grading:user_collection_grading ( provider, grade )"
        )
        .eq("user_id", userId)
        .eq("collection_item_id", collection_item_id)
        .eq("graded", graded)
        .eq("derived", false)
        .eq("deleted", false)

      if (signal.aborted) return

      if (ucRes.error) {
        setError(ucRes.error.message)
        setLoading(false)
        return
      }

      setSourceQuantity((ucRes.data ?? []).length)
      setAvailableQuantity(
        (ucRes.data ?? []).filter(
          (r) => !(r as { grading?: boolean | null }).grading
        ).length
      )

      const ucRows = (ucRes.data ?? []) as Array<{
        grading?: boolean | null
        user_collection_grading?:
          | { provider: string; grade: number }
          | { provider: string; grade: number }[]
          | null
      }>

      setGradingCount(ucRows.filter((r) => Boolean(r.grading)).length)

      if (graded) {
        const levelCounts: Record<string, { provider: string; grade: number; count: number }> = {}
        for (const r of ucRows) {
          const raw = r.user_collection_grading
          const g = Array.isArray(raw) ? raw[0] : raw ?? null
          if (!g?.provider || typeof g.grade !== "number") continue
          const levelKey = `${g.provider}:${g.grade}`
          const current = levelCounts[levelKey]
          levelCounts[levelKey] = current
            ? { ...current, count: current.count + 1 }
            : { provider: g.provider, grade: g.grade, count: 1 }
        }
        setGradedLevelCounts(levelCounts)
      } else {
        setGradedLevelCounts({})
      }

      const ids = Array.from(
        new Set(
          (ucRes.data ?? [])
            .map((r) => (r as { buying_entries_id: string | null }).buying_entries_id)
            .filter((v): v is string => Boolean(v))
        )
      )

      const allUcForCardRes = await supabase
        .from("user_collection")
        .select("id, derived, grading, created_at")
        .eq("user_id", userId)
        .eq("collection_item_id", collection_item_id)
        .eq("graded", graded)
        .eq("deleted", false)

      if (signal.aborted) return

      if (!allUcForCardRes.error && allUcForCardRes.data) {
        setOverviewRows((allUcForCardRes.data ?? []) as OverviewCollectionRow[])
      }

      const allUcIdsForCard = Array.from(
        new Set(
          (allUcForCardRes.data ?? [])
            .map((r) => (r as { id: string }).id)
            .filter((v): v is string => Boolean(v))
        )
      )

      if (allUcIdsForCard.length) {
        const costByUcId = new Map<string, MiscCostLine[]>()
        const linksRes = await supabase
          .from("user_collection_miscellaneous")
          .select("user_collection_id, miscellaneous_entries_id")
          .eq("user_id", userId)
          .in("user_collection_id", allUcIdsForCard)

        if (signal.aborted) return

        if (!linksRes.error && linksRes.data?.length) {
          const links = linksRes.data as Array<{
            user_collection_id: string
            miscellaneous_entries_id: string
          }>

          const miscIds = Array.from(
            new Set(
              links
                .map((l) => l.miscellaneous_entries_id)
                .filter((v): v is string => Boolean(v))
            )
          )

          const miscMap = new Map<string, MiscCostLine>()
          if (miscIds.length) {
            const miscRes = await supabase
              .from("miscellaneous_entries")
              .select("id, date, price, type, description")
              .eq("user_id", userId)
              .in("id", miscIds)

            if (signal.aborted) return

            if (!miscRes.error && miscRes.data) {
              for (const me of miscRes.data as Array<{
                id: string
                date: string
                price: number
                type: string
                description: string | null
              }>) {
                miscMap.set(me.id, {
                  id: me.id,
                  date: me.date,
                  price: Number(me.price) || 0,
                  type: me.type,
                  description: me.description ?? null,
                })
              }
            }
          }

          for (const l of links) {
            const line = miscMap.get(l.miscellaneous_entries_id)
            if (!line) continue
            const existing = costByUcId.get(l.user_collection_id) ?? []
            costByUcId.set(l.user_collection_id, [...existing, line])
          }
        }

        const gradingRecordsRes = await supabase
          .from("user_collection_sending_to_grade")
            .select("id, user_collection_id, sent_at, created_at, executed")
          .eq("user_id", userId)
          .in("user_collection_id", allUcIdsForCard)
            .eq("executed", false)
          .order("sent_at", { ascending: false })

        if (signal.aborted) return
        if (!gradingRecordsRes.error && gradingRecordsRes.data) {
          const enriched = (gradingRecordsRes.data as Array<{
            id: string
            user_collection_id: string
            sent_at: string
            created_at: string
          }>).map((r) => {
            const costLines = costByUcId.get(r.user_collection_id) ?? []
            const costTotal = costLines.reduce((sum, c) => sum + (Number(c.price) || 0), 0)
            return { ...r, costLines, costTotal }
          })
          setGradingRecords(enriched as GradingRecordRow[])
        }
      }

      // NOTE: Grading/graded chip summary is derived from `ucRes` above to stay consistent with `MyCollection`.

      if (ids.length) {
        const buysRes = await supabase
          .from("buy_entries")
          .select("id, purchase_date, price_hkd, quantity, graded, collection_item_id")
          .in("id", ids)
          .order("purchase_date", { ascending: false })

        if (signal.aborted) return

        if (buysRes.error) {
          setError(buysRes.error.message)
          setLoading(false)
          return
        }

        setBuyEntries((buysRes.data ?? []) as BuyEntry[])
      } else {
        setBuyEntries([])
      }

      // Derived records (mappings where this page's card appears as source or target)
      if (allUcForCardRes.error) {
        setDerivedError(allUcForCardRes.error.message)
        setDerivedLoading(false)
      } else if (!allUcIdsForCard.length) {
        setDerivedLoading(false)
      } else {
        const uuidList = allUcIdsForCard.join(",")

        const derivedRes = await supabase
          .from("user_derived_collection")
          .select("id, from_user_collection_id, to_user_collection_id, created_at")
          .eq("user_id", userId)
          .or(
            `to_user_collection_id.in.(${uuidList}),from_user_collection_id.in.(${uuidList})`
          )
          .order("created_at", { ascending: false })

        if (signal.aborted) return

        if (derivedRes.error) {
          setDerivedError(derivedRes.error.message)
          setDerivedLoading(false)
        } else {
          const seedMappings = (derivedRes.data ?? []) as Array<{
            id: string
            from_user_collection_id: string
            to_user_collection_id: string
            created_at: string
          }>

          // Also include other derived items that share the same source (from_user_collection_id)
          const seedFromIds = Array.from(
            new Set(seedMappings.map((r) => r.from_user_collection_id).filter(Boolean))
          )

          let rawMappings = seedMappings
          if (seedFromIds.length) {
            const siblingRes = await supabase
              .from("user_derived_collection")
              .select("id, from_user_collection_id, to_user_collection_id, created_at")
              .eq("user_id", userId)
              .in("from_user_collection_id", seedFromIds)
              .order("created_at", { ascending: false })

            if (signal.aborted) return

            if (!siblingRes.error && siblingRes.data?.length) {
              const all = [...seedMappings, ...(siblingRes.data as any)]
              const seen = new Set<string>()
              rawMappings = all.filter((r) => {
                if (!r?.id) return false
                if (seen.has(r.id)) return false
                seen.add(r.id)
                return true
              })
            }
          }

          const ucJoinIds = Array.from(
            new Set(
              rawMappings.flatMap((r) => [r.from_user_collection_id, r.to_user_collection_id])
            )
          )

          let ucMap = new Map<string, UserCollectionRow>()
          if (ucJoinIds.length) {
            const ucJoinRes = await supabase
              .from("user_collection")
              .select(
                "id, graded, collection_item_id, collection_base:collection_item_id ( id, game_title, card_no, name, image_cloud_path )"
              )
              .eq("user_id", userId)
              .in("id", ucJoinIds)
              .eq("deleted", false)

            if (signal.aborted) return

            if (!ucJoinRes.error && ucJoinRes.data) {
              const rows = ucJoinRes.data as unknown as UserCollectionRow[]
              rows.forEach((r) => ucMap.set(r.id, r))
            }
          }

          const mappingIds = rawMappings.map((r) => r.id)
          const costsByMappingId = new Map<string, MiscCostLine[]>()

          if (mappingIds.length) {
            const udcmRes = await supabase
              .from("user_derived_collection_miscellaneous")
              .select("user_derived_collection_id, miscellaneous_entries_id")
              .eq("user_id", userId)
              .in("user_derived_collection_id", mappingIds)

            if (signal.aborted) return

            if (udcmRes.error) {
              // If link table isn't readable due to RLS, just show no costs.
            } else if (udcmRes.data?.length) {
              const links = udcmRes.data as unknown as Array<{
                user_derived_collection_id: string
                miscellaneous_entries_id: string
              }>

              const miscIds = Array.from(
                new Set(
                  links
                    .map((l) => l.miscellaneous_entries_id)
                    .filter((v): v is string => Boolean(v))
                )
              )

              const miscMap = new Map<string, MiscCostLine>()
              if (miscIds.length) {
                const miscRes = await supabase
                  .from("miscellaneous_entries")
                  .select("id, date, price, type, description")
                  .eq("user_id", userId)
                  .in("id", miscIds)

                if (signal.aborted) return

                if (!miscRes.error && miscRes.data) {
                  for (const me of miscRes.data as unknown as Array<{
                    id: string
                    date: string
                    price: number
                    type: string
                    description: string | null
                  }>) {
                    miscMap.set(me.id, {
                      id: me.id,
                      date: me.date,
                      price: Number(me.price) || 0,
                      type: me.type,
                      description: me.description ?? null,
                    })
                  }
                }
              }

              for (const l of links) {
                const line = miscMap.get(l.miscellaneous_entries_id)
                if (!line) continue
                const existing = costsByMappingId.get(l.user_derived_collection_id) ?? []
                costsByMappingId.set(l.user_derived_collection_id, [...existing, line])
              }
            }
          }

          const merged: DerivedRecordRow[] = rawMappings.map((r) => {
            const lines = costsByMappingId.get(r.id) ?? []
            const costTotal = lines.reduce((s, l) => s + l.price, 0)
            return {
              id: r.id,
              from_user_collection_id: r.from_user_collection_id,
              to_user_collection_id: r.to_user_collection_id,
              created_at: r.created_at,
              from_user_collection: ucMap.get(r.from_user_collection_id) ?? null,
              to_user_collection: ucMap.get(r.to_user_collection_id) ?? null,
              costLines: lines,
              costTotal,
            }
          })

          setDerivedRecords(merged)
          setDerivedLoading(false)

          // Signed images for source + derived items
          if (workerOrigin?.trim() && token) {
            const baseUrl = workerOrigin.replace(/\/+$/, "")
            const pathKeys: Array<{ key: string; path: string | null | undefined }> = []
            for (const dr of merged) {
              pathKeys.push({
                key: `from:${dr.from_user_collection_id}`,
                path: dr.from_user_collection?.collection_base?.image_cloud_path ?? null,
              })
              pathKeys.push({
                key: `to:${dr.to_user_collection_id}`,
                path: dr.to_user_collection?.collection_base?.image_cloud_path ?? null,
              })
            }
            await Promise.all(
              pathKeys.map(async ({ key, path }) => {
                const filePath = path
                if (!filePath) return
                try {
                  const res = await fetch(
                    `${baseUrl}/signed?file=${encodeURIComponent(filePath)}&ttl=300`,
                    { headers: { Authorization: `Bearer ${token}` }, signal }
                  )
                  if (!res.ok) return
                  const data = (await res.json()) as { url?: string }
                  if (!data.url) return
                  setDerivedImageUrls((prev) => ({ ...prev, [key]: data.url! }))
                } catch {
                  // ignore
                }
              })
            )

            // Persist paths so we can refresh later when URLs expire.
            const nextPaths: Record<string, string> = {}
            for (const { key, path } of pathKeys) {
              if (path) nextPaths[key] = path
            }
            setDerivedImagePaths(nextPaths)
          }
        }
      }

      // Signed image URL for display (optional)
      if (workerOrigin?.trim() && token && baseItem.image_cloud_path) {
        try {
          const baseUrl = workerOrigin.replace(/\/+$/, "")
          const signedRes = await fetch(
            `${baseUrl}/signed?file=${encodeURIComponent(baseItem.image_cloud_path)}&ttl=300`,
            { headers: { Authorization: `Bearer ${token}` }, signal }
          )
          if (signedRes.ok) {
            const data = (await signedRes.json()) as { url?: string }
            if (data.url) setImageUrl(data.url)
          }
        } catch {
          // ignore image errors
        }
      }

      setLoading(false)
    })()
  }

  useEffect(() => {
    if (graded && recordsView === "grading") setRecordsView("purchase")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graded])

  useEffect(() => {
    // Hard load: show skeletons.
    fetchAll({ soft: false })

    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection_item_id, graded, user?.id, workerOrigin])

  useEffect(() => {
    // Soft refresh (after updates/submits): keep UI visible.
    if (!reloadKey) return
    fetchAll({ soft: true })
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  // Re-sign image URLs when switching panels that show images.
  useEffect(() => {
    if (recordsView !== "derived" && recordsView !== "grading") return
    const pathKeys: Array<{ key: string; path: string | null | undefined }> = []
    if (sourceImagePath) pathKeys.push({ key: "source", path: sourceImagePath })
    for (const [key, path] of Object.entries(derivedImagePaths)) pathKeys.push({ key, path })

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current
    refreshSignedUrls(pathKeys, signal)
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsView, sourceImagePath, derivedImagePaths])

  // Periodically refresh signed URLs so idle sessions keep images working.
  useEffect(() => {
    if (!workerOrigin?.trim()) return
    const id = window.setInterval(() => {
      const pathKeys: Array<{ key: string; path: string | null | undefined }> = []
      if (sourceImagePath) pathKeys.push({ key: "source", path: sourceImagePath })
      for (const [key, path] of Object.entries(derivedImagePaths)) pathKeys.push({ key, path })
      refreshSignedUrls(pathKeys)
    }, 240_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerOrigin, sourceImagePath, derivedImagePaths])

  return (
    <main className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 pb-40 sm:pb-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="gap-2 px-2"
              onClick={() => navigate({ to: "/user/my-collection" })}
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
              My Collection
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() =>
                navigate({
                  to: "/user/my-collection/$collection_item_id",
                  params: { collection_item_id },
                  search: { graded: !graded },
                })
              }
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {graded ? "View Raw" : "View Graded"}
            </Button>
          </div>

          {error ? (
            <p className="mb-3 text-left text-sm text-destructive">{error}</p>
          ) : null}

          <div className="grid min-w-0 gap-4 lg:grid-cols-[360px_1fr]">
            <ItemInfoCard
              loading={loading}
              imageUrl={imageUrl}
              title={title}
              workerOrigin={workerOrigin}
            gradedLevelCounts={gradedLevelCounts}
            gradingCount={gradingCount}
              overviewCounts={overviewCounts}
              item={item}
              itemFields={itemFields}
              sourceQuantity={sourceQuantity}
              availableQuantity={availableQuantity}
              graded={graded}
              onOpenGrade={() => setGradeOpen(true)}
              onOpenDerive={() => setDeriveOpen(true)}
              onDeleted={() => setReloadKey((k) => k + 1)}
              onEdited={() => setReloadKey((k) => k + 1)}
            />

            <div
              key={recordsView}
              className="animate-in fade-in-0 duration-200"
            >
              <RecordsPanel
                recordsView={recordsView}
                setRecordsView={setRecordsView}
                hideGradingView={graded}
                loading={loading}
                buyEntries={buyEntries}
                derivedLoading={derivedLoading}
                derivedError={derivedError}
                derivedRecords={derivedRecords}
                derivedImageUrls={derivedImageUrls}
                gradingRecords={gradingRecords}
                overviewRows={overviewRows}
                sourceImageUrl={imageUrl}
                sourceTitle={title}
                formatMoneyHKD={formatMoneyHKD}
              onRefresh={() => setReloadKey((k) => k + 1)}
              />
            </div>
          </div>
        </div>
      </div>

      <DeriveDialog
        open={deriveOpen}
        onOpenChange={setDeriveOpen}
        sourceCollectionItemId={collection_item_id}
        sourceGraded={graded}
        sourceQuantity={availableQuantity}
        onSubmitted={() => setReloadKey((k) => k + 1)}
      />

      <GradingCostDialog
        open={gradeOpen}
        onOpenChange={setGradeOpen}
        collectionItemId={collection_item_id}
        sourceQuantity={availableQuantity}
        onSubmitted={() => setReloadKey((k) => k + 1)}
      />
    </main>
  )
}

