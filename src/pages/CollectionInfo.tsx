import { Button } from "@/components/ui/button"
import { GradingChip } from "@/components/GradingChip"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { Link, useNavigate } from "@tanstack/react-router"
import { Route } from "@/routes/user/my-collection/$collection_item_id"
import { ArrowLeft } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { DeriveDialog } from "@/components/dialogs/DeriveDialog"
import { GradingCostDialog } from "../components/dialogs/GradingCostDialog"

type CollectionBase = {
  id: string
  game_title: string | null
  card_no: string | null
  name: string | null
  image_cloud_path: string | null
}

type BuyEntry = {
  id: string
  purchase_date: string
  price_hkd: number
  quantity: number
}

type DerivedRecordRow = {
  from_user_collection_id: string
  created_at: string
  from_user_collection: {
    id: string
    graded: boolean
    collection_item_id: string
    collection_base: CollectionBase | null
  } | null
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />
}

function SkeletonMuted({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted/50 ${className}`} />
}

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

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [item, setItem] = useState<CollectionBase | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [buyEntries, setBuyEntries] = useState<BuyEntry[]>([])
  const [grading, setGrading] = useState<{ provider: string; grade: number } | null>(
    null
  )
  const [derivedLoading, setDerivedLoading] = useState(false)
  const [derivedError, setDerivedError] = useState<string | null>(null)
  const [derivedRecords, setDerivedRecords] = useState<DerivedRecordRow[]>([])
  const [derivedImageUrls, setDerivedImageUrls] = useState<Record<string, string>>({})
  const [deriveOpen, setDeriveOpen] = useState(false)
  const [gradeOpen, setGradeOpen] = useState(false)
  const [sourceQuantity, setSourceQuantity] = useState(0)

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
    setDerivedLoading(true)
    setDerivedError(null)
    setDerivedRecords([])
    setDerivedImageUrls({})

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
          "id, buying_entries_id, user_collection_grading:user_collection_grading ( provider, grade )"
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

      const ids = Array.from(
        new Set(
          (ucRes.data ?? [])
            .map((r) => (r as { buying_entries_id: string | null }).buying_entries_id)
            .filter((v): v is string => Boolean(v))
        )
      )

      const userCollectionIds = Array.from(
        new Set(
          (ucRes.data ?? [])
            .map((r) => (r as { id: string }).id)
            .filter((v): v is string => Boolean(v))
        )
      )

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

      // Derived records
      if (userCollectionIds.length) {
        const derivedRes = await supabase
          .from("user_derived_collection")
          .select("from_user_collection_id, created_at")
          .eq("user_id", userId)
          .in("to_user_collection_id", userCollectionIds)
          .order("created_at", { ascending: false })

        if (signal.aborted) return

        if (derivedRes.error) {
          setDerivedError(derivedRes.error.message)
          setDerivedLoading(false)
        } else {
          const fromIds = Array.from(
            new Set(
              (derivedRes.data ?? [])
                .map((r) => (r as { from_user_collection_id: string }).from_user_collection_id)
                .filter((v): v is string => Boolean(v))
            )
          )

          let fromMap = new Map<string, DerivedRecordRow["from_user_collection"]>()
          if (fromIds.length) {
            const fromUcRes = await supabase
              .from("user_collection")
              .select(
                "id, graded, collection_item_id, collection_base:collection_item_id ( id, game_title, card_no, name, image_cloud_path )"
              )
              .eq("user_id", userId)
              .in("id", fromIds)

            if (signal.aborted) return

            if (!fromUcRes.error) {
              const rows = (fromUcRes.data ?? []) as unknown as Array<{
                id: string
                graded: boolean
                collection_item_id: string
                collection_base: CollectionBase | null
              }>
              rows.forEach((r) => fromMap.set(r.id, r))
            }
          }

          const merged: DerivedRecordRow[] = (derivedRes.data ?? []).map((r) => {
            const row = r as { from_user_collection_id: string; created_at: string }
            return {
              from_user_collection_id: row.from_user_collection_id,
              created_at: row.created_at,
              from_user_collection: fromMap.get(row.from_user_collection_id) ?? null,
            }
          })

          setDerivedRecords(merged)
          setDerivedLoading(false)

          // Signed images for derived records
          if (workerOrigin?.trim() && token) {
            const baseUrl = workerOrigin.replace(/\/+$/, "")
            await Promise.all(
              merged.map(async (dr) => {
                const filePath = dr.from_user_collection?.collection_base?.image_cloud_path
                if (!filePath) return
                try {
                  const res = await fetch(
                    `${baseUrl}/signed?file=${encodeURIComponent(filePath)}&ttl=300`,
                    { headers: { Authorization: `Bearer ${token}` }, signal }
                  )
                  if (!res.ok) return
                  const data = (await res.json()) as { url?: string }
                  if (!data.url) return
                  setDerivedImageUrls((prev) => ({
                    ...prev,
                    [dr.from_user_collection_id]: data.url!,
                  }))
                } catch {
                  // ignore
                }
              })
            )
          }
        }
      } else {
        setDerivedLoading(false)
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
  }, [collection_item_id, graded, user?.id, workerOrigin])

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
          {/* Left: item info */}
          <section className="min-w-0 rounded-2xl border bg-zinc-900 p-4 text-left text-white lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <div className="aspect-[4/3] w-full bg-white/5">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    className="h-full w-full object-cover object-left-top"
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-white/10" />
                )}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {loading && !grading ? (
                <div className="flex items-center justify-start">
                  <Skeleton className="h-5 w-24" />
                </div>
              ) : grading ? (
                <div className="flex items-center justify-start">
                  <GradingChip provider={grading.provider} grade={grading.grade} tone="dark" />
                </div>
              ) : null}
              {loading && !item ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <h1 className="text-base font-semibold leading-snug">{title}</h1>
              )}
              <dl className="space-y-2 text-sm">
                {loading && !item ? (
                  <>
                    <div className="grid grid-cols-[110px_1fr] gap-3">
                      <dt className="text-white/60">Game Title</dt>
                      <dd className="min-w-0">
                        <Skeleton className="h-4 w-32" />
                      </dd>
                    </div>
                    <div className="grid grid-cols-[110px_1fr] gap-3">
                      <dt className="text-white/60">Card Number</dt>
                      <dd className="min-w-0">
                        <Skeleton className="h-4 w-24" />
                      </dd>
                    </div>
                    <div className="grid grid-cols-[110px_1fr] gap-3">
                      <dt className="text-white/60">Name</dt>
                      <dd className="min-w-0">
                        <Skeleton className="h-4 w-40" />
                      </dd>
                    </div>
                  </>
                ) : itemFields.length ? (
                  itemFields.map((f) => (
                    <div key={f.label} className="grid grid-cols-[110px_1fr] gap-3">
                      <dt className="text-white/60">{f.label}</dt>
                      <dd className="min-w-0 text-white/90">{f.value}</dd>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/60">No item details found.</p>
                )}
              </dl>

              <div className="pt-2">
                {!graded ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => setGradeOpen(true)}
                    disabled={loading || !item}
                  >
                    Grade
                  </Button>
                ) : null}
                <div className={!graded ? "mt-2" : undefined}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setDeriveOpen(true)}
                  disabled={loading || !item}
                >
                  Derive
                </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Right: purchase records */}
          <section className="min-w-0 rounded-2xl border bg-card/40 p-4 text-left">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Purchase records</h2>
              {loading ? (
                <SkeletonMuted className="h-4 w-20" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {buyEntries.length} record{buyEntries.length === 1 ? "" : "s"}
                </p>
              )}
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border bg-background/40 p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <SkeletonMuted className="h-4 w-24" />
                      <SkeletonMuted className="h-4 w-20" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <SkeletonMuted className="h-3 w-10" />
                        <div className="mt-1">
                          <SkeletonMuted className="h-4 w-24" />
                        </div>
                      </div>
                      <div className="text-right">
                        <SkeletonMuted className="ml-auto h-3 w-8" />
                        <div className="mt-1">
                          <SkeletonMuted className="ml-auto h-4 w-10" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : buyEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchase records found.</p>
            ) : (
              <>
                {/* Desktop header */}
                <div className="hidden grid-cols-[140px_1fr_90px_110px] gap-3 border-b pb-2 text-xs font-medium text-muted-foreground lg:grid">
                  <div>Date</div>
                  <div>Price (per 1)</div>
                  <div>Qty</div>
                  <div className="text-right">Total</div>
                </div>

                <div className="mt-2 space-y-2">
                  {buyEntries.map((b) => {
                    const total = (Number(b.price_hkd) || 0) * (Number(b.quantity) || 0)
                    return (
                      <div
                        key={b.id}
                        className="rounded-xl border bg-background/40 p-3"
                      >
                        {/* Mobile layout */}
                        <div className="grid gap-2 lg:hidden">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-sm font-medium">{b.purchase_date}</p>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="text-xs">Price</span>
                            <div className="mt-0.5 flex items-baseline justify-between gap-3">
                              <div className="min-w-0 text-foreground">
                                {formatMoneyHKD(Number(b.price_hkd))}{" "}
                                <span className="text-muted-foreground">×</span>{" "}
                                {b.quantity}
                              </div>
                              <div className="shrink-0 text-foreground">
                                {formatMoneyHKD(total)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Desktop row */}
                        <div className="hidden grid-cols-[140px_1fr_90px_110px] items-center gap-3 lg:grid">
                          <div className="text-sm">{b.purchase_date}</div>
                          <div className="text-sm">{formatMoneyHKD(Number(b.price_hkd))}</div>
                          <div className="text-sm">{b.quantity}</div>
                          <div className="text-right text-sm font-semibold">
                            {formatMoneyHKD(total)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          {/* Derived Records */}
          <section className="min-w-0 rounded-2xl border bg-card/40 p-4 text-left lg:col-start-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Derived Records</h2>
              {derivedLoading ? (
                <SkeletonMuted className="h-4 w-20" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {derivedRecords.length} record{derivedRecords.length === 1 ? "" : "s"}
                </p>
              )}
            </div>

            {derivedError ? (
              <p className="text-sm text-destructive">{derivedError}</p>
            ) : derivedLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border bg-background/40 p-3">
                    <SkeletonMuted className="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <SkeletonMuted className="h-4 w-40" />
                      <div className="mt-2">
                        <SkeletonMuted className="h-3 w-24" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : derivedRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No derived records found.</p>
            ) : (
              <div className="space-y-2">
                {derivedRecords.map((dr) => {
                  const base = dr.from_user_collection?.collection_base
                  const name = base?.name ?? "Untitled"
                  const img = derivedImageUrls[dr.from_user_collection_id]
                  const targetCollectionItemId = dr.from_user_collection?.collection_item_id
                  const targetGraded = dr.from_user_collection?.graded ?? false
                  return (
                    <Link
                      key={`${dr.from_user_collection_id}-${dr.created_at}`}
                      to="/user/my-collection/$collection_item_id"
                      params={{ collection_item_id: targetCollectionItemId ?? "" }}
                      search={{ graded: targetGraded }}
                      className="flex items-center gap-3 rounded-xl border bg-background/40 p-3 transition hover:bg-muted/30"
                    >
                      <div className="h-12 w-12 overflow-hidden rounded-lg border bg-muted/30">
                        {img ? (
                          <img
                            src={img}
                            alt={name}
                            className="h-full w-full object-cover object-left-top"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full animate-pulse bg-muted/50" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(dr.created_at).toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <DeriveDialog
        open={deriveOpen}
        onOpenChange={setDeriveOpen}
        sourceCollectionItemId={collection_item_id}
        sourceGraded={graded}
        sourceQuantity={sourceQuantity}
      />

      <GradingCostDialog
        open={gradeOpen}
        onOpenChange={setGradeOpen}
        collectionItemId={collection_item_id}
        sourceQuantity={sourceQuantity}
      />
    </main>
  )
}

