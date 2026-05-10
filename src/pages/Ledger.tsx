import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CollapsibleHeader, useCollapsibleHeader } from "@/components/CollapsibleHeader"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight } from "lucide-react"

type LedgerKind = "Buy" | "Sell" | "Misc"

type MiscLink = { label: string; imageUrl: string | null; imagePath?: string | null }

type LedgerRow = {
  id: string
  dateISO: string
  createdAtISO: string
  kind: LedgerKind
  imageUrl: string | null
  derivedFromImageUrl: string | null
  derivedToImageUrl: string | null
  graded: boolean | null
  name: string | null
  gameTitle: string | null
  cardNo: string | null
  quantity: number | null
  unitPriceHKD: number | null
  amountHKD: number
  miscType: string | null
  description: string | null
  miscLinks: MiscLink[]
}

function formatISODate(iso: string): string {
  const s = String(iso ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—"
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function formatISODateParts(iso: string): { md: string; year: string } | null {
  const s = String(iso ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return {
    md: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    year: dt.toLocaleDateString(undefined, { year: "numeric" }),
  }
}

function formatHKD(n: number): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return "$0.00"
  return `$${v.toFixed(2)}`
}

export function Ledger() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const { containerRef, headerRef, headerHeight, onScroll, animatedStyle } = useCollapsibleHeader()

  const totalBalanceHKD = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.amountHKD) || 0), 0)
  }, [rows])

  useEffect(() => {
    const userId = user?.id
    if (!userId) return

    setLoading(true)
    setError(null)

    ;(async () => {
      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token ?? null

      const [buysRes, sellsRes, miscRes] = await Promise.all([
        supabase
          .from("buy_entries")
          .select(
            "id, created_at, graded, purchase_date, price_hkd, quantity, collection_base:collection_item_id ( name, game_title, card_no, image_cloud_path )"
          )
          .eq("user_id", userId),
        supabase
          .from("sell_entries")
          .select(
            "id, created_at, selling_date, price_hkd, quantity, user_collection:user_collection_id ( graded, collection_base:collection_item_id ( name, game_title, card_no, image_cloud_path ) )"
          )
          .eq("user_id", userId),
        supabase
          .from("miscellaneous_entries")
          .select("id, created_at, date, price, type, description")
          .eq("user_id", userId),
      ])

      const firstErr = buysRes.error ?? sellsRes.error ?? miscRes.error
      if (firstErr) {
        setRows([])
        setError(firstErr.message)
        setLoading(false)
        return
      }

      const out: LedgerRow[] = []
      const imagePaths = new Set<string>()
      const miscIds: string[] = []

      for (const r of (buysRes.data ?? []) as any[]) {
        const qty = Number(r.quantity ?? 0)
        const unit = Number(r.price_hkd ?? 0)
        const baseRaw = r.collection_base
        const base = Array.isArray(baseRaw) ? baseRaw[0] : baseRaw
        const amount = Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : 0
        const imagePath = (base?.image_cloud_path as string | null | undefined) ?? null
        if (imagePath) imagePaths.add(imagePath)
        out.push({
          id: String(r.id),
          dateISO: String(r.purchase_date ?? "").slice(0, 10),
          createdAtISO: String(r.created_at ?? ""),
          kind: "Buy",
          imageUrl: null,
          derivedFromImageUrl: null,
          derivedToImageUrl: null,
          graded: typeof r.graded === "boolean" ? r.graded : null,
          name: (base?.name as string | null | undefined) ?? null,
          gameTitle: (base?.game_title as string | null | undefined) ?? null,
          cardNo: (base?.card_no as string | null | undefined) ?? null,
          quantity: Number.isFinite(qty) ? qty : null,
          unitPriceHKD: Number.isFinite(unit) ? unit : null,
          amountHKD: -Math.abs(amount),
          miscType: null,
          description: null,
          miscLinks: [],
        })
      }

      for (const r of (sellsRes.data ?? []) as any[]) {
        const qty = Number(r.quantity ?? 0)
        const unit = Number(r.price_hkd ?? 0)
        const amount = Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : 0
        const ucRaw = r.user_collection
        const uc = Array.isArray(ucRaw) ? ucRaw[0] : ucRaw
        const baseRaw = uc?.collection_base
        const base = Array.isArray(baseRaw) ? baseRaw[0] : baseRaw
        const imagePath = (base?.image_cloud_path as string | null | undefined) ?? null
        if (imagePath) imagePaths.add(imagePath)
        out.push({
          id: String(r.id),
          dateISO: String(r.selling_date ?? "").slice(0, 10),
          createdAtISO: String(r.created_at ?? ""),
          kind: "Sell",
          imageUrl: null,
          derivedFromImageUrl: null,
          derivedToImageUrl: null,
          graded: typeof uc?.graded === "boolean" ? uc.graded : null,
          name: (base?.name as string | null | undefined) ?? null,
          gameTitle: (base?.game_title as string | null | undefined) ?? null,
          cardNo: (base?.card_no as string | null | undefined) ?? null,
          quantity: Number.isFinite(qty) ? qty : null,
          unitPriceHKD: Number.isFinite(unit) ? unit : null,
          amountHKD: Math.abs(amount),
          miscType: null,
          description: null,
          miscLinks: [],
        })
      }

      for (const r of (miscRes.data ?? []) as any[]) {
        const p = Number(r.price ?? 0)
        const id = String(r.id)
        miscIds.push(id)
        out.push({
          id,
          dateISO: String(r.date ?? "").slice(0, 10),
          createdAtISO: String(r.created_at ?? ""),
          kind: "Misc",
          imageUrl: null,
          derivedFromImageUrl: null,
          derivedToImageUrl: null,
          graded: null,
          name: null,
          gameTitle: null,
          cardNo: null,
          quantity: null,
          unitPriceHKD: null,
          amountHKD: -Math.abs(Number.isFinite(p) ? p : 0),
          miscType: (r.type as string | null | undefined) ?? null,
          description: (r.description as string | null | undefined) ?? null,
          miscLinks: [],
        })
      }

      // Enrich miscellaneous rows with links to grading / derived mappings.
      const miscLinksById = new Map<string, MiscLink[]>()
      const derivedThumbByMiscId = new Map<string, { fromPath: string | null; toPath: string | null }>()
      if (miscIds.length) {
        const [ucmRes, udcmRes] = await Promise.all([
          supabase
            .from("user_collection_miscellaneous")
            .select("user_collection_id, miscellaneous_entries_id")
            .eq("user_id", userId)
            .in("miscellaneous_entries_id", miscIds),
          supabase
            .from("user_derived_collection_miscellaneous")
            .select("user_derived_collection_id, miscellaneous_entries_id")
            .eq("user_id", userId)
            .in("miscellaneous_entries_id", miscIds),
        ])

        // If these fail (RLS), we still show misc rows without link info.
        const ucm = (ucmRes.error ? [] : (ucmRes.data ?? [])) as any[]
        const udcm = (udcmRes.error ? [] : (udcmRes.data ?? [])) as any[]

        const ucmUcIds = Array.from(
          new Set(
            ucm
              .map((x) => String(x.user_collection_id ?? ""))
              .filter((v) => v.length > 0)
          )
        )

        const derivedIds = Array.from(
          new Set(
            udcm
              .map((x) => String(x.user_derived_collection_id ?? ""))
              .filter((v) => v.length > 0)
          )
        )

        const [gradeRes, derivedRes, ucBaseRes] = await Promise.all([
          ucmUcIds.length
            ? supabase
                .from("user_collection_sending_to_grade")
                .select("user_collection_id, sent_at, executed")
                .eq("user_id", userId)
                .in("user_collection_id", ucmUcIds)
            : Promise.resolve({ data: [] as any[], error: null as any }),
          derivedIds.length
            ? supabase
                .from("user_derived_collection")
                .select(
                  "id, from_user_collection_id, to_user_collection_id, from_user_collection:from_user_collection_id ( collection_base:collection_item_id ( name, game_title, card_no, image_cloud_path ) ), to_user_collection:to_user_collection_id ( collection_base:collection_item_id ( name, game_title, card_no, image_cloud_path ) )"
                )
                .eq("user_id", userId)
                .in("id", derivedIds)
            : Promise.resolve({ data: [] as any[], error: null as any }),
          ucmUcIds.length
            ? supabase
                .from("user_collection")
                .select(
                  "id, collection_base:collection_item_id ( name, image_cloud_path )"
                )
                .eq("user_id", userId)
                .in("id", ucmUcIds)
            : Promise.resolve({ data: [] as any[], error: null as any }),
        ])

        const gradeRows = (gradeRes.error ? [] : (gradeRes.data ?? [])) as any[]
        const gradedUc = new Map<string, { sent_at: string | null; executed: boolean | null }>()
        for (const r of gradeRows) {
          const id = String(r.user_collection_id ?? "")
          if (!id) continue
          gradedUc.set(id, {
            sent_at: (r.sent_at as string | null | undefined) ?? null,
            executed: typeof r.executed === "boolean" ? r.executed : null,
          })
        }

        const derivedRows = (derivedRes.error ? [] : (derivedRes.data ?? [])) as any[]
        const derivedById = new Map<string, any>()
        for (const r of derivedRows) derivedById.set(String(r.id), r)

        const ucBaseRows = (ucBaseRes.error ? [] : (ucBaseRes.data ?? [])) as any[]
        const ucBaseById = new Map<string, { name: string | null; image_cloud_path: string | null }>()
        for (const r of ucBaseRows) {
          const id = String(r.id ?? "")
          if (!id) continue
          const baseRaw = r.collection_base
          const base = Array.isArray(baseRaw) ? baseRaw[0] : baseRaw
          const path = (base?.image_cloud_path as string | null | undefined) ?? null
          if (path) imagePaths.add(path)
          ucBaseById.set(id, {
            name: (base?.name as string | null | undefined) ?? null,
            image_cloud_path: path,
          })
        }

        for (const link of ucm) {
          const miscId = String(link.miscellaneous_entries_id ?? "")
          const ucId = String(link.user_collection_id ?? "")
          if (!miscId || !ucId) continue
          const g = gradedUc.get(ucId)
          const base = ucBaseById.get(ucId) ?? null
          const label =
            g
              ? `Grading${g.executed === true ? " (executed)" : ""}${g.sent_at ? ` • sent ${formatISODate(String(g.sent_at).slice(0, 10))}` : ""}`
              : "Linked to collection item"
          miscLinksById.set(miscId, [
            ...(miscLinksById.get(miscId) ?? []),
            {
              label: base?.name ? `${label} • ${base.name}` : label,
              imageUrl: null,
              imagePath: base?.image_cloud_path ?? null,
            },
          ])
        }

        for (const link of udcm) {
          const miscId = String(link.miscellaneous_entries_id ?? "")
          const derivedId = String(link.user_derived_collection_id ?? "")
          if (!miscId || !derivedId) continue
          const d = derivedById.get(derivedId)
          if (d) {
            const fromBaseRaw = d.from_user_collection?.collection_base
            const fromBase = Array.isArray(fromBaseRaw) ? fromBaseRaw[0] : fromBaseRaw
            const toBaseRaw = d.to_user_collection?.collection_base
            const toBase = Array.isArray(toBaseRaw) ? toBaseRaw[0] : toBaseRaw
            const fromName = (fromBase?.name as string | null | undefined) ?? "Source"
            const toName = (toBase?.name as string | null | undefined) ?? "Derived"
            const fromPath = (fromBase?.image_cloud_path as string | null | undefined) ?? null
            const toPath = (toBase?.image_cloud_path as string | null | undefined) ?? null
            if (fromPath) imagePaths.add(fromPath)
            if (toPath) imagePaths.add(toPath)
            derivedThumbByMiscId.set(miscId, { fromPath, toPath })
            miscLinksById.set(miscId, [
              ...(miscLinksById.get(miscId) ?? []),
              { label: `Derived • ${fromName} → ${toName}`, imageUrl: null },
            ])
          } else {
            miscLinksById.set(miscId, [
              ...(miscLinksById.get(miscId) ?? []),
              { label: "Derived", imageUrl: null },
            ])
          }
        }
      }

      // Fetch signed image URLs (Cloudflare Worker) for any item images.
      const imageUrlByPath = new Map<string, string>()
      if (workerOrigin?.trim() && token && imagePaths.size) {
        const base = workerOrigin.replace(/\/$/, "")
        await Promise.all(
          Array.from(imagePaths).map(async (path) => {
            try {
              const res = await fetch(
                `${base}/signed?file=${encodeURIComponent(path)}&ttl=300`,
                { headers: { Authorization: `Bearer ${token}` } }
              )
              if (!res.ok) return
              const data = (await res.json()) as { url?: string }
              if (data.url) imageUrlByPath.set(path, data.url)
            } catch {
              // ignore
            }
          })
        )
      }

      // Apply signed image URLs + misc link labels into rows
      for (const r of out) {
        if (r.kind === "Buy" || r.kind === "Sell") {
          // Find the image path again from base fields is not stored; re-derive from cardNo/name isn't safe.
          // Instead, we set imageUrl by matching order of push above using the same base reference:
          // (We can only fill it when Supabase returned an image path; use a best-effort map by scanning row fields.)
          // For now, keep it null if we can't map confidently.
        } else {
          r.miscLinks = (miscLinksById.get(r.id) ?? []).map((x) => ({
            ...x,
            imageUrl:
              x.imagePath && imageUrlByPath.size
                ? imageUrlByPath.get(x.imagePath) ?? null
                : null,
          }))

          const derivedThumb = derivedThumbByMiscId.get(r.id) ?? null
          r.derivedFromImageUrl =
            derivedThumb?.fromPath && imageUrlByPath.size
              ? imageUrlByPath.get(derivedThumb.fromPath) ?? null
              : null
          r.derivedToImageUrl =
            derivedThumb?.toPath && imageUrlByPath.size
              ? imageUrlByPath.get(derivedThumb.toPath) ?? null
              : null

          // If this misc entry is grading-related and we have an item image,
          // show it in the same slot as Buy/Sell thumbnails.
          const gradingThumb =
            r.miscLinks.find((l) => l.imageUrl && l.label.startsWith("Grading")) ??
            r.miscLinks.find((l) => l.imageUrl) ??
            null
          if (gradingThumb?.imageUrl) r.imageUrl = gradingThumb.imageUrl
        }
      }

      // Best-effort: fill imageUrl for buy/sell by re-walking the original data arrays in the same order we pushed.
      let idx = 0
      for (const r of (buysRes.data ?? []) as any[]) {
        const baseRaw = r.collection_base
        const base = Array.isArray(baseRaw) ? baseRaw[0] : baseRaw
        const path = (base?.image_cloud_path as string | null | undefined) ?? null
        if (out[idx] && out[idx].kind === "Buy") out[idx].imageUrl = path ? imageUrlByPath.get(path) ?? null : null
        idx++
      }
      for (const r of (sellsRes.data ?? []) as any[]) {
        const ucRaw = r.user_collection
        const uc = Array.isArray(ucRaw) ? ucRaw[0] : ucRaw
        const baseRaw = uc?.collection_base
        const base = Array.isArray(baseRaw) ? baseRaw[0] : baseRaw
        const path = (base?.image_cloud_path as string | null | undefined) ?? null
        if (out[idx] && out[idx].kind === "Sell") out[idx].imageUrl = path ? imageUrlByPath.get(path) ?? null : null
        idx++
      }

      // (Grading misc link images are filled via imagePath → signed url above.)

      out.sort((a, b) => {
        // 1) Transaction day desc (purchase/sell/misc date)
        if (a.dateISO !== b.dateISO) return a.dateISO < b.dateISO ? 1 : -1
        // 2) Within the same day, created_at desc
        const ac = a.createdAtISO || ""
        const bc = b.createdAtISO || ""
        if (ac === bc) return 0
        return ac < bc ? 1 : -1
      })
      setRows(out)
      setLoading(false)
    })()
  }, [user?.id])

  return (
    <main className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col">
        <CollapsibleHeader
          containerRef={containerRef}
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
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Button>
          }
          title={<h1 className="text-xl font-semibold">My Balance</h1>}
        />

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 [&::-webkit-scrollbar]:hidden"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingTop: headerHeight,
          }}
          onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
        >
          <Separator className="my-4" />

          <div className="grid grid-cols-12 gap-3 pb-6">
            <section className="col-span-12">
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-muted/20 via-background to-background shadow-sm ring-1 ring-border/60">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                    <CardTitle className="text-base">All records</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block size-2.5 rounded-full bg-red-500/70" aria-hidden="true" />
                        <span>Buy (spend)</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block size-2.5 rounded-full bg-emerald-500/70" aria-hidden="true" />
                        <span>Sell (gain)</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block size-2.5 rounded-full bg-amber-500/70" aria-hidden="true" />
                        <span>Misc (cost)</span>
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}

                  <div className="mt-2 overflow-hidden rounded-xl border bg-card">
                    <div className="max-h-[70dvh] overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="sticky top-0 z-10 grid grid-cols-[88px_minmax(0,1fr)_96px] items-center gap-3 rounded-t-xl border-b bg-muted/20 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[88px_86px_minmax(0,1fr)_52px_84px_96px]">
                        <div>Date</div>
                        <div className="hidden sm:block">Type</div>
                        <div>Item / Notes</div>
                        <div className="hidden text-right sm:block">Qty</div>
                        <div className="hidden text-right sm:block">Price</div>
                        <div className="text-right">Amount</div>
                      </div>

                    {loading ? (
                      <div className="p-3">
                        <div className="h-10 animate-pulse rounded-lg bg-muted/25" />
                      </div>
                    ) : rows.length === 0 ? (
                      <div className="p-6 text-sm text-muted-foreground">No records yet.</div>
                    ) : (
                      <div className="divide-y">
                        {rows.map((r) => {
                          const k = `${r.kind}:${r.id}`
                          const open = expandedKey === k
                          const amountClass =
                            r.amountHKD > 0
                              ? "text-emerald-600"
                              : r.amountHKD < 0
                                ? "text-red-600"
                                : "text-muted-foreground"
                          const typeBadge =
                            r.kind === "Buy"
                              ? "bg-red-500/15 text-red-700 dark:text-red-300"
                              : r.kind === "Sell"
                                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                                : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                          const typeGradient =
                            r.kind === "Buy"
                              ? "from-red-500/35 via-red-500/10"
                              : r.kind === "Sell"
                                ? "from-emerald-500/35 via-emerald-500/10"
                                : "from-amber-500/35 via-amber-500/10"
                          const itemTitle =
                            r.kind === "Misc"
                              ? r.miscType ?? "Misc"
                              : r.name ?? "Unknown item"

                          return (
                            <div
                              key={k}
                              className="w-full"
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedKey((cur) => (cur === k ? null : k))}
                                className="relative w-full cursor-pointer text-left"
                                aria-expanded={open}
                              >
                                <div
                                  className={[
                                    "pointer-events-none absolute inset-y-0 left-0 w-56 bg-gradient-to-r to-transparent",
                                    typeGradient,
                                  ].join(" ")}
                                  aria-hidden="true"
                                />
                                <div className="relative grid grid-cols-[88px_minmax(0,1fr)_96px] items-start gap-3 px-3 py-3 text-sm hover:bg-muted/20 sm:grid-cols-[88px_86px_minmax(0,1fr)_52px_84px_96px] sm:items-center">
                                  <div className="flex items-center justify-between gap-2 text-xs text-white">
                                    {(() => {
                                      const parts = formatISODateParts(r.dateISO)
                                      return parts ? (
                                        <span className="min-w-0 leading-tight">
                                          <span className="sm:hidden">
                                            <span className="block">{parts.md}</span>
                                            <span className="block">{parts.year}</span>
                                          </span>
                                          <span className="hidden sm:inline">{formatISODate(r.dateISO)}</span>
                                        </span>
                                      ) : (
                                        <span>—</span>
                                      )
                                    })()}
                                  </div>
                                  <div className="hidden items-center gap-2 text-xs font-medium sm:flex">
                                    <span
                                      className={[
                                        "inline-flex items-center rounded-md px-2 py-0.5",
                                        typeBadge,
                                      ].join(" ")}
                                    >
                                      {r.kind}
                                    </span>
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex min-w-0 flex-col items-start gap-2 lg:flex-row lg:justify-between">
                                      <div className="min-w-0 text-left">
                                        <div className="whitespace-normal break-normal text-pretty font-medium leading-snug">
                                          {itemTitle}
                                        </div>
                                        {r.kind !== "Misc" ? (
                                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                            <p className="line-clamp-1">{r.gameTitle || "—"}</p>
                                            <p className="line-clamp-1">{r.cardNo || "—"}</p>
                                            <div className="sm:hidden">
                                              <span
                                                className={[
                                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                                  r.graded
                                                    ? "border-sky-200 bg-sky-50 text-sky-700"
                                                    : "border-zinc-200 bg-zinc-50 text-zinc-700",
                                                ].join(" ")}
                                              >
                                                {r.graded ? "Graded" : "Raw"}
                                              </span>
                                            </div>
                                          </div>
                                        ) : r.description ? (
                                          <div className="truncate text-xs text-muted-foreground">
                                            {r.description}
                                          </div>
                                        ) : null}
                                      </div>
                                      {r.kind === "Misc" &&
                                      r.derivedFromImageUrl &&
                                      r.derivedToImageUrl ? (
                                        <div className="shrink-0 lg:ml-2">
                                          <div className="flex items-center gap-1">
                                            <div className="size-9 overflow-hidden rounded-md border bg-muted/20">
                                              <img
                                                src={r.derivedFromImageUrl}
                                                alt="Source item"
                                                className="h-full w-full object-cover object-left-top"
                                                loading="lazy"
                                              />
                                            </div>
                                            <ArrowRight
                                              className="size-4 text-muted-foreground"
                                              aria-hidden="true"
                                            />
                                            <div className="size-9 overflow-hidden rounded-md border bg-muted/20">
                                              <img
                                                src={r.derivedToImageUrl}
                                                alt="Derived item"
                                                className="h-full w-full object-cover object-left-top"
                                                loading="lazy"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ) : r.imageUrl ? (
                                        <div className="size-9 shrink-0 overflow-hidden rounded-md border bg-muted/20 lg:ml-2">
                                          <img
                                            src={r.imageUrl}
                                            alt={itemTitle}
                                            className="h-full w-full object-cover object-left-top"
                                            loading="lazy"
                                          />
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="hidden text-right tabular-nums text-xs text-muted-foreground sm:block">
                                    {typeof r.quantity === "number" ? r.quantity : "—"}
                                  </div>
                                  <div className="hidden text-right tabular-nums text-xs text-muted-foreground sm:block">
                                    {typeof r.unitPriceHKD === "number"
                                      ? formatHKD(r.unitPriceHKD)
                                      : "—"}
                                  </div>
                                  <div
                                    className={[
                                      "text-right font-semibold tabular-nums",
                                      amountClass,
                                    ].join(" ")}
                                  >
                                    {formatHKD(r.amountHKD)}
                                  </div>
                                </div>
                              </button>

                              <div
                                className={[
                                  "grid overflow-hidden px-3 transition-[max-height,opacity] duration-300",
                                  open ? "max-h-64 opacity-100" : "max-h-0 opacity-0",
                                ].join(" ")}
                                aria-hidden={!open}
                              >
                                <div className="pb-3">
                                  <div className="rounded-lg border bg-muted/10 p-3 text-left">
                                    <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                                      <div>
                                        <span className="font-medium text-foreground">Date:</span>{" "}
                                        {formatISODate(r.dateISO)}
                                      </div>
                                      <div>
                                        <span className="font-medium text-foreground">Qty:</span>{" "}
                                        {typeof r.quantity === "number" ? r.quantity : "—"}
                                      </div>
                                      <div>
                                        <span className="font-medium text-foreground">Unit:</span>{" "}
                                        {typeof r.unitPriceHKD === "number"
                                          ? formatHKD(r.unitPriceHKD)
                                          : "—"}
                                      </div>
                                    </div>

                                    {r.kind === "Misc" ? (
                                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                        {r.miscType ? (
                                          <div>
                                            <span className="font-medium text-foreground">Type:</span>{" "}
                                            {r.miscType}
                                          </div>
                                        ) : null}
                                        {r.description ? (
                                          <div>
                                            <span className="font-medium text-foreground">Description:</span>{" "}
                                            {r.description}
                                          </div>
                                        ) : null}
                                        {r.miscLinks.length ? (
                                          <div className="pt-1">
                                            <span className="font-medium text-foreground">Linked:</span>
                                            <div className="mt-1 space-y-1">
                                              {r.miscLinks.map((l) => (
                                                <div key={l.label} className="truncate">
                                                  {l.label}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <div className="mt-2 text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">Item:</span>{" "}
                                        {[r.gameTitle, r.cardNo].filter(Boolean).join(" • ") || "—"}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="sticky bottom-0 z-10 rounded-b-xl border-t bg-muted/20 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-medium text-muted-foreground">Total balance</p>
                        {loading ? (
                          <div className="h-5 w-20 animate-pulse rounded bg-muted/40" aria-label="Loading total balance" />
                        ) : (
                          <p
                            className={[
                              "text-sm font-semibold tabular-nums",
                              totalBalanceHKD >= 0 ? "text-emerald-600" : "text-red-600",
                            ].join(" ")}
                          >
                            {formatHKD(totalBalanceHKD)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

