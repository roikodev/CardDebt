import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { useNavigate } from "@tanstack/react-router"
import { Route } from "@/routes/user/my-collection/$collection_item_id"
import { ArrowLeft } from "lucide-react"
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
  const [buyEntries, setBuyEntries] = useState<BuyEntry[]>([])
  const [grading, setGrading] = useState<{ provider: string; grade: number } | null>(
    null
  )
  const [gradingRecordCount, setGradingRecordCount] = useState(0)
  const [derivedLoading, setDerivedLoading] = useState(false)
  const [derivedError, setDerivedError] = useState<string | null>(null)
  const [derivedRecords, setDerivedRecords] = useState<DerivedRecordRow[]>([])
  const [derivedImageUrls, setDerivedImageUrls] = useState<Record<string, string>>({})
  const [gradingRecords, setGradingRecords] = useState<GradingRecordRow[]>([])
  const [deriveOpen, setDeriveOpen] = useState(false)
  const [gradeOpen, setGradeOpen] = useState(false)
  const [sourceQuantity, setSourceQuantity] = useState(0)
  const [availableQuantity, setAvailableQuantity] = useState(0)

  const abortRef = useRef<AbortController | null>(null)

  const title = item?.name ?? "Untitled"
  const itemFields = useMemo(() => {
    return [
      { label: "Game Title", value: item?.game_title ?? null },
      { label: "Card Number", value: item?.card_no ?? null },
      { label: "Name", value: item?.name ?? null },
    ].filter((f) => f.value)
  }, [item?.card_no, item?.game_title, item?.name])

  useEffect(() => {
    const userId = user?.id
    if (!userId) return

    setLoading(true)
    setError(null)
    setItem(null)
    setImageUrl(null)
    setBuyEntries([])
    setGrading(null)
    setGradingRecordCount(0)
    setDerivedLoading(true)
    setDerivedError(null)
    setDerivedRecords([])
    setDerivedImageUrls({})
    setGradingRecords([])
    setRecordsView("purchase")

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    ;(async () => {
      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token ?? null

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

      const ucRes = await supabase
        .from("user_collection")
        .select(
          "id, buying_entries_id, grading, user_collection_grading:user_collection_grading ( provider, grade )"
        )
        .eq("user_id", userId)
        .eq("collection_item_id", collection_item_id)
        .eq("graded", graded)
        .eq("derived", false)

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

      const ids = Array.from(
        new Set(
          (ucRes.data ?? [])
            .map((r) => (r as { buying_entries_id: string | null }).buying_entries_id)
            .filter((v): v is string => Boolean(v))
        )
      )

      const allUcForCardRes = await supabase
        .from("user_collection")
        .select("id, grading")
        .eq("user_id", userId)
        .eq("collection_item_id", collection_item_id)
        .eq("graded", graded)

      if (signal.aborted) return

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
          .select("id, user_collection_id, sent_at, created_at")
          .eq("user_id", userId)
          .in("user_collection_id", allUcIdsForCard)
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

      if (!allUcForCardRes.error && allUcForCardRes.data) {
        const count = (allUcForCardRes.data as Array<{ grading?: boolean | null }>).filter(
          (r) => Boolean(r.grading)
        ).length
        setGradingRecordCount(count)
      }

      if (graded) {
        const first = ((ucRes.data ?? [])[0] ?? null) as unknown as {
          user_collection_grading?:
            | { provider: string; grade: number }
            | { provider: string; grade: number }[]
            | null
        } | null
        const raw = first?.user_collection_grading
        const g = Array.isArray(raw) ? raw[0] : raw ?? null
        if (g?.provider && typeof g.grade === "number") {
          setGrading({ provider: g.provider, grade: g.grade })
        }
      }

      if (ids.length) {
        const buysRes = await supabase
          .from("buy_entries")
          .select("id, purchase_date, price_hkd, quantity")
          .in("id", ids)
          .order("purchase_date", { ascending: false })

        if (signal.aborted) return

        if (buysRes.error) {
          setError(buysRes.error.message)
          setLoading(false)
          return
        }

        setBuyEntries((buysRes.data ?? []) as BuyEntry[])
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

    return () => abortRef.current?.abort()
  }, [collection_item_id, graded, user?.id, workerOrigin, reloadKey])

  return (
    <main className="flex h-screen flex-col overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            className="gap-2 px-2"
            onClick={() => navigate({ to: "/user/my-collection" })}
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
            My Collection
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
            grading={grading}
            gradingRecordCount={gradingRecordCount}
            item={item}
            itemFields={itemFields}
            sourceQuantity={sourceQuantity}
            availableQuantity={availableQuantity}
            graded={graded}
            onOpenGrade={() => setGradeOpen(true)}
            onOpenDerive={() => setDeriveOpen(true)}
          />

          <RecordsPanel
            recordsView={recordsView}
            setRecordsView={setRecordsView}
            loading={loading}
            buyEntries={buyEntries}
            derivedLoading={derivedLoading}
            derivedError={derivedError}
            derivedRecords={derivedRecords}
            derivedImageUrls={derivedImageUrls}
            gradingRecords={gradingRecords}
            sourceImageUrl={imageUrl}
            sourceTitle={title}
            formatMoneyHKD={formatMoneyHKD}
          />
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

