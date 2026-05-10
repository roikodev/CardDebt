import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BuyProductDialog } from "@/components/dialogs/BuyProductDialog"
import { BuyProductByCardBaseDialog } from "@/components/dialogs/BuyProductByCardBaseDialog"
import { CardBaseDialog } from "@/components/dialogs/CardBaseDialog"
import { SellChooseItemDialog, type SellChoice } from "@/components/dialogs/SellChooseItemDialog"
import { SellInfoDialog } from "@/components/dialogs/SellInfoDialog"
import { MiscellaneousEntryDialog } from "@/components/dialogs/MiscellaneousEntryDialog"
import { BalanceChangeCard, TotalBalanceCard } from "@/components/dashboard/BalanceCards"
import { RoiSection } from "@/components/dashboard/RoiSection"
import { SpendingPieSection } from "@/components/dashboard/SpendingPieSection"
import {
  GameTitleGainingPieSection,
  GameTitleSpendingPieSection,
} from "@/components/dashboard/GameTitleSpendingPieSection"
import { ActivityTrendSection } from "@/components/dashboard/ActivityTrendSection"
import { ViewportDeferred } from "@/components/dashboard/ViewportDeferred"
import {
  deriveActivityTrendPoints,
  deriveCompareBalanceAgoHKD,
  deriveFlowTotals,
  deriveGameTitleGainingSlices,
  deriveGameTitleSpendingSlices,
  deriveTotalBalanceHKD,
  type LedgerBuyRow,
  type LedgerMiscRow,
  type LedgerSellRow,
} from "@/components/dashboard/ledgerDerived"
import type { DashboardTimeRange } from "@/components/dashboard/TimeRangeFilter"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { useNavigate } from "@tanstack/react-router"
import {
  CreditCard,
  LayoutGrid,
  Folder,
  HandCoins,
  LogOut,
  PlusSquare,
  Settings,
  ShoppingCart,
} from "lucide-react"

function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function daysAgoISODate(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function useAnimatedBalance({
  target,
  loading,
}: {
  target: number | null
  loading: boolean
}) {
  const rafRef = useRef<number | null>(null)
  const startAtRef = useRef<number | null>(null)
  const [display, setDisplay] = useState<number>(0)

  // Show a steadily increasing "rolling" number while loading
  useEffect(() => {
    if (!loading) return

    const base = typeof target === "number" ? Math.abs(target) : 5000
    const range = clampNumber(base || 5000, 300, 50000)

    function tick() {
      setDisplay((prev) => {
        const prevSafe = Number.isFinite(prev) ? prev : 0
        const maxStep = Math.max(8, range * 0.018)
        const minStep = Math.max(2, range * 0.006)
        const step = minStep + Math.random() * (maxStep - minStep)
        const next = prevSafe + step
        const cap = range * 1.05
        return next > cap ? cap : next
      })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [loading, target])

  // Settle to target when loaded
  useEffect(() => {
    if (loading) return
    if (typeof target !== "number" || !Number.isFinite(target)) return

    const targetValue = target

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null

    const fallback =
      (Math.random() > 0.5 ? 1 : -1) *
      Math.random() *
      Math.max(300, Math.abs(targetValue))
    const from =
      startAtRef.current ?? (display !== 0 ? display : fallback)

    const durationMs = 700
    const start = performance.now()
    startAtRef.current = from

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3)
    }

    function tick(now: number) {
      const t = clampNumber((now - start) / durationMs, 0, 1)
      const eased = easeOutCubic(t)
      const v = from + (targetValue - from) * eased
      setDisplay(v)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else {
        setDisplay(targetValue)
        startAtRef.current = null
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, target])

  return display
}

function GridGroup({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`col-span-12 grid grid-cols-12 gap-3 md:col-span-3 ${className}`.trim()}
    >
      {children}
    </section>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined
  const [buyChooserOpen, setBuyChooserOpen] = useState(false)
  const [buyOpen, setBuyOpen] = useState(false)
  const [sellChooseOpen, setSellChooseOpen] = useState(false)
  const [sellInfoOpen, setSellInfoOpen] = useState(false)
  const [sellChoice, setSellChoice] = useState<SellChoice | null>(null)
  const [miscOpen, setMiscOpen] = useState(false)
  const [cardBaseOpen, setCardBaseOpen] = useState(false)
  const [buyByCardBaseOpen, setBuyByCardBaseOpen] = useState(false)
  const [selectedCardBaseItem, setSelectedCardBaseItem] =
    useState<import("@/components/dialogs/CardBaseDialog").CollectionBaseRow | null>(
      null
    )

  const [dashboardRange, setDashboardRange] = useState<DashboardTimeRange>("all")
  const [balanceReloadKey, setBalanceReloadKey] = useState(0)
  const [ledger, setLedger] = useState<{
    buys: LedgerBuyRow[]
    sells: LedgerSellRow[]
    misc: LedgerMiscRow[]
  } | null>(null)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  /** Rows shown in My Collection: non-derived, not soft-deleted. */
  const [collectionCount, setCollectionCount] = useState<number | null>(null)

  type RoiRow = {
    collection_item_id: string
    graded: boolean
    name: string
    game_title: string | null
    card_no: string | null
    image_cloud_path: string | null
    image_url: string | null
    buy_cost: number
    misc_cost: number
    total_cost: number
    total_revenue: number
    total_profit: number
    roi: number
  }

  const [roiLoading, setRoiLoading] = useState(false)
  const [roiError, setRoiError] = useState<string | null>(null)
  const [roiRawTop, setRoiRawTop] = useState<RoiRow[]>([])
  const [roiGradedTop, setRoiGradedTop] = useState<RoiRow[]>([])
  const [roiSort, setRoiSort] = useState<"roi" | "profit">("profit")
  const [roiSortApplied, setRoiSortApplied] = useState<"roi" | "profit">("profit")
  /** Bumps when ROI rows are committed — same pattern as My Balance `rowsAnimKey` after fetch. */
  const [roiRowsAnimKey, setRoiRowsAnimKey] = useState(0)
  const roiRunRef = useRef(0)
  const [roiExpandedKey, setRoiExpandedKey] = useState<string | null>(null)

  const totalBalanceHKD = useMemo(() => {
    if (!ledger) return null
    return deriveTotalBalanceHKD(ledger.buys, ledger.sells, ledger.misc)
  }, [ledger])

  const totalBalanceAgoHKD = useMemo(() => {
    if (!ledger) return null
    return deriveCompareBalanceAgoHKD(
      ledger.buys,
      ledger.sells,
      ledger.misc,
      dashboardRange
    )
  }, [ledger, dashboardRange])

  const flowTotals = useMemo(
    () =>
      ledger
        ? deriveFlowTotals(ledger.buys, ledger.sells, ledger.misc, dashboardRange)
        : { buy: 0, sell: 0, misc: 0 },
    [ledger, dashboardRange]
  )

  const activityTrendPoints = useMemo(
    () =>
      ledger
        ? deriveActivityTrendPoints(
            dashboardRange,
            ledger.buys,
            ledger.sells,
            ledger.misc
          )
        : [],
    [ledger, dashboardRange]
  )

  const gameTitleSlices = useMemo(
    () =>
      ledger ? deriveGameTitleSpendingSlices(ledger.buys, dashboardRange) : [],
    [ledger, dashboardRange]
  )

  const gameTitleGainingSlices = useMemo(
    () =>
      ledger ? deriveGameTitleGainingSlices(ledger.sells, dashboardRange) : [],
    [ledger, dashboardRange]
  )

  const animatedBalance = useAnimatedBalance({
    target: totalBalanceHKD,
    loading: ledgerLoading,
  })

  const refreshLedger = useCallback(async () => {
    const userId = user?.id
    if (!userId) {
      setLedger(null)
      setLedgerError(null)
      setLedgerLoading(false)
      return
    }

    setLedgerLoading(true)
    setLedgerError(null)

    const [buysRes, sellsRes, miscRes] = await Promise.all([
      supabase
        .from("buy_entries")
        .select(
          "price_hkd, quantity, purchase_date, collection_base:collection_item_id ( game_title )"
        )
        .eq("user_id", userId),
      supabase
        .from("sell_entries")
        .select(
          "price_hkd, quantity, selling_date, user_collection:user_collection_id ( collection_base:collection_item_id ( game_title ) )"
        )
        .eq("user_id", userId),
      supabase.from("miscellaneous_entries").select("price, date").eq("user_id", userId),
    ])

    const err = buysRes.error ?? sellsRes.error ?? miscRes.error
    if (err) {
      setLedger(null)
      setLedgerError(err.message)
      setLedgerLoading(false)
      return
    }

    setLedger({
      buys: (buysRes.data ?? []) as LedgerBuyRow[],
      sells: (sellsRes.data ?? []) as LedgerSellRow[],
      misc: (miscRes.data ?? []) as LedgerMiscRow[],
    })
    setLedgerLoading(false)
  }, [user?.id])

  const refreshCollectionCount = useCallback(async () => {
    const userId = user?.id
    if (!userId) {
      setCollectionCount(null)
      return
    }

    const res = await supabase
      .from("user_collection")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("derived", false)
      .eq("deleted", false)

    if (res.error) {
      setCollectionCount(null)
      return
    }

    setCollectionCount(typeof res.count === "number" ? res.count : 0)
  }, [user?.id])

  const refreshRoi = useCallback(async () => {
    const userId = user?.id
    if (!userId) {
      setRoiRawTop([])
      setRoiGradedTop([])
      setRoiError(null)
      return
    }

    const runId = ++roiRunRef.current
    setRoiLoading(true)
    setRoiError(null)

    const [buysRes, sellsRes] = await Promise.all([
      supabase
        .from("buy_entries")
        .select("collection_item_id, graded, price_hkd, quantity, purchase_date")
        .eq("user_id", userId),
      supabase
        .from("sell_entries")
        .select("user_collection_id, price_hkd, quantity, selling_date")
        .eq("user_id", userId),
    ])

    const firstError = buysRes.error ?? sellsRes.error
    if (firstError) {
      setRoiRawTop([])
      setRoiGradedTop([])
      setRoiError(firstError.message)
      setRoiRowsAnimKey((n) => n + 1)
      setRoiLoading(false)
      return
    }

    const buysAll = (buysRes.data ?? []) as Array<{
      collection_item_id?: string | null
      // Some older rows / schemas might use a different column name.
      collection_base_id?: string | null
      graded?: boolean | null
      price_hkd?: unknown
      quantity?: unknown
      purchase_date?: string | null
    }>

    const sellsAll = (sellsRes.data ?? []) as Array<{
      user_collection_id: string
      price_hkd: number
      quantity: number
      selling_date: string
    }>

    const soldUcIds = Array.from(
      new Set(sellsAll.map((s) => s.user_collection_id).filter(Boolean))
    )

    const soldUcRes =
      soldUcIds.length === 0
        ? { data: [] as any[], error: null as any }
        : await supabase
            .from("user_collection")
            .select("id, graded, collection_item_id")
            .eq("user_id", userId)
            .in("id", soldUcIds)

    if (soldUcRes.error) {
      setRoiRawTop([])
      setRoiGradedTop([])
      setRoiError(soldUcRes.error.message)
      setRoiRowsAnimKey((n) => n + 1)
      setRoiLoading(false)
      return
    }

    const soldUcById = new Map<
      string,
      { graded: boolean; collection_item_id: string }
    >()
    for (const r of soldUcRes.data as Array<{
      id: string
      graded: boolean
      collection_item_id: string
    }>) {
      soldUcById.set(r.id, { graded: r.graded, collection_item_id: r.collection_item_id })
    }

    const buyItemIds = buysAll
      .map((b) => (b as any).collection_item_id ?? (b as any).collection_base_id ?? null)
      .filter((v): v is string => typeof v === "string" && v.length > 0)

    const itemIds = Array.from(
      new Set([...buyItemIds, ...Array.from(soldUcById.values()).map((x) => x.collection_item_id)])
    )

    const baseRes =
      itemIds.length === 0
        ? { data: [] as any[], error: null as any }
        : await supabase
            .from("collection_base")
            .select("id, name, game_title, card_no, image_cloud_path")
            .in("id", itemIds)

    if (baseRes.error) {
      setRoiRawTop([])
      setRoiGradedTop([])
      setRoiError(baseRes.error.message)
      setRoiRowsAnimKey((n) => n + 1)
      setRoiLoading(false)
      return
    }

    const baseById = new Map<
      string,
      {
        name: string
        game_title: string | null
        card_no: string | null
        image_cloud_path: string | null
      }
    >()
    for (const b of baseRes.data as Array<{
      id: string
      name: string
      game_title: string | null
      card_no: string | null
      image_cloud_path: string | null
    }>) {
      baseById.set(b.id, {
        name: b.name,
        game_title: b.game_title,
        card_no: b.card_no,
        image_cloud_path: b.image_cloud_path ?? null,
      })
    }

    const keyOf = (collection_item_id: string, graded: boolean) =>
      `${collection_item_id}::${graded ? "g" : "r"}`

    type MiscEntryRow = { id: string; price: number; date: string }
    const miscEntriesById = new Map<string, MiscEntryRow>()
    const miscLinkPairs: Array<{ miscId: string; key: string }> = []

    // Misc cost attribution (only misc entries linked to collection items)
    if (itemIds.length) {
      const allUcRes = await supabase
        .from("user_collection")
        .select("id, graded, collection_item_id")
        .eq("user_id", userId)
        .in("collection_item_id", itemIds)

      if (allUcRes.error) {
        setRoiRawTop([])
        setRoiGradedTop([])
        setRoiError(allUcRes.error.message)
        setRoiRowsAnimKey((n) => n + 1)
        setRoiLoading(false)
        return
      }

      const ucKeyById = new Map<string, string>()
      const allUcIds: string[] = []
      for (const r of allUcRes.data as Array<{
        id: string
        graded: boolean
        collection_item_id: string
      }>) {
        allUcIds.push(r.id)
        ucKeyById.set(r.id, keyOf(r.collection_item_id, !!r.graded))
      }

      const [ucmRes, derivedMapRes] = await Promise.all([
        allUcIds.length
          ? supabase
              .from("user_collection_miscellaneous")
              .select("user_collection_id, miscellaneous_entries_id")
              .eq("user_id", userId)
              .in("user_collection_id", allUcIds)
          : Promise.resolve({ data: [] as any[], error: null as any }),
        allUcIds.length
          ? supabase
              .from("user_derived_collection")
              .select("id, to_user_collection_id")
              .eq("user_id", userId)
              .in("to_user_collection_id", allUcIds)
          : Promise.resolve({ data: [] as any[], error: null as any }),
      ])

      if (ucmRes.error || derivedMapRes.error) {
        setRoiRawTop([])
        setRoiGradedTop([])
        setRoiError((ucmRes.error ?? derivedMapRes.error).message)
        setRoiRowsAnimKey((n) => n + 1)
        setRoiLoading(false)
        return
      }

      const derivedMapIdToUcId = new Map<string, string>()
      const derivedMapIds: string[] = []
      for (const m of derivedMapRes.data as Array<{
        id: string
        to_user_collection_id: string
      }>) {
        derivedMapIds.push(m.id)
        derivedMapIdToUcId.set(m.id, m.to_user_collection_id)
      }

      const derivedMiscRes =
        derivedMapIds.length === 0
          ? { data: [] as any[], error: null as any }
          : await supabase
              .from("user_derived_collection_miscellaneous")
              .select("user_derived_collection_id, miscellaneous_entries_id")
              .eq("user_id", userId)
              .in("user_derived_collection_id", derivedMapIds)

      if (derivedMiscRes.error) {
        setRoiRawTop([])
        setRoiGradedTop([])
        setRoiError(derivedMiscRes.error.message)
        setRoiRowsAnimKey((n) => n + 1)
        setRoiLoading(false)
        return
      }

      const links: Array<{ miscId: string; key: string }> = []
      for (const l of ucmRes.data as Array<{
        user_collection_id: string
        miscellaneous_entries_id: string
      }>) {
        const k = ucKeyById.get(l.user_collection_id)
        if (!k) continue
        links.push({ miscId: l.miscellaneous_entries_id, key: k })
      }

      for (const l of derivedMiscRes.data as Array<{
        user_derived_collection_id: string
        miscellaneous_entries_id: string
      }>) {
        const ucId = derivedMapIdToUcId.get(l.user_derived_collection_id)
        if (!ucId) continue
        const k = ucKeyById.get(ucId)
        if (!k) continue
        links.push({ miscId: l.miscellaneous_entries_id, key: k })
      }

      const miscIds = Array.from(new Set(links.map((x) => x.miscId).filter(Boolean)))
      const miscRes =
        miscIds.length === 0
          ? { data: [] as any[], error: null as any }
          : await supabase
              .from("miscellaneous_entries")
              .select("id, price, date")
              .eq("user_id", userId)
              .in("id", miscIds)

      if (miscRes.error) {
        setRoiRawTop([])
        setRoiGradedTop([])
        setRoiError(miscRes.error.message)
        setRoiRowsAnimKey((n) => n + 1)
        setRoiLoading(false)
        return
      }

      for (const me of miscRes.data as Array<MiscEntryRow>) {
        const p = Number(me.price ?? 0)
        if (!Number.isFinite(p)) continue
        miscEntriesById.set(me.id, { id: me.id, price: p, date: String(me.date ?? "") })
      }

      miscLinkPairs.push(...links)
    }

    function computeTop(days: number | null) {
      const cutoff = days === null ? null : daysAgoISODate(days)

      const buyCostByKey = new Map<string, number>()
      const revenueByKey = new Map<string, number>()
      const miscCostByKey = new Map<string, number>()

      for (const b of buysAll) {
        const d = String((b as any).purchase_date ?? "")
        if (cutoff && (!d || d < cutoff)) continue
        const itemId =
          (b as any).collection_item_id ?? (b as any).collection_base_id ?? null
        if (!itemId) continue
        const k = keyOf(String(itemId), Boolean((b as any).graded))
        const price = Number((b as any).price_hkd ?? 0)
        const qty = Number((b as any).quantity ?? 0)
        if (!Number.isFinite(price) || !Number.isFinite(qty)) continue
        buyCostByKey.set(k, (buyCostByKey.get(k) ?? 0) + price * qty)
      }

      for (const s of sellsAll) {
        const d = String((s as any).selling_date ?? "")
        if (cutoff && (!d || d < cutoff)) continue
        const uc = soldUcById.get(s.user_collection_id)
        if (!uc) continue
        const k = keyOf(uc.collection_item_id, !!uc.graded)
        const price = Number(s.price_hkd ?? 0)
        const qty = Number(s.quantity ?? 0)
        if (!Number.isFinite(price) || !Number.isFinite(qty)) continue
        revenueByKey.set(k, (revenueByKey.get(k) ?? 0) + price * qty)
      }

      for (const { miscId, key } of miscLinkPairs) {
        const me = miscEntriesById.get(miscId)
        if (!me) continue
        const d = String(me.date ?? "")
        if (cutoff && (!d || d < cutoff)) continue
        miscCostByKey.set(key, (miscCostByKey.get(key) ?? 0) + (me.price ?? 0))
      }

      const allKeys = Array.from(
        new Set([
          ...Array.from(buyCostByKey.keys()),
          ...Array.from(revenueByKey.keys()),
          ...Array.from(miscCostByKey.keys()),
        ])
      )

      const rows: RoiRow[] = []
      for (const k of allKeys) {
        const [collection_item_id, kind] = k.split("::")
        const graded = kind === "g"
        const base = baseById.get(collection_item_id)
        if (!base) continue

        const buyCost = buyCostByKey.get(k) ?? 0
        const miscCost = miscCostByKey.get(k) ?? 0
        const totalCost = buyCost + miscCost
        const totalRevenue = revenueByKey.get(k) ?? 0
        if (!(totalCost > 0)) continue

        const profit = totalRevenue - totalCost
        const roi = profit / totalCost

        rows.push({
          collection_item_id,
          graded,
          name: base.name,
          game_title: base.game_title,
          card_no: base.card_no,
          image_cloud_path: base.image_cloud_path ?? null,
          image_url: null,
          buy_cost: buyCost,
          misc_cost: miscCost,
          total_cost: totalCost,
          total_revenue: totalRevenue,
          total_profit: profit,
          roi,
        })
      }

      rows.sort((a, b) => {
        if (roiSort === "profit") {
          return (b.total_profit - a.total_profit) || (b.roi - a.roi)
        }
        return (b.roi - a.roi) || (b.total_profit - a.total_profit)
      })
      const raw = rows.filter((r) => !r.graded).slice(0, 10)
      const gradedRows = rows.filter((r) => r.graded).slice(0, 10)
      return { raw, graded: gradedRows }
    }

    const windowDays =
      dashboardRange === "all"
        ? null
        : dashboardRange === "365"
          ? 365
          : dashboardRange === "180"
            ? 180
            : 90
    const { raw, graded: gradedRows } = computeTop(windowDays)

    // Fetch signed image URLs for visible rows only
    const needSigning = [...raw, ...gradedRows].filter(
      (r) => r.image_cloud_path && workerOrigin?.trim()
    )

    if (needSigning.length) {
      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token
      if (token) {
        const baseUrl = (workerOrigin ?? "").replace(/\/+$/, "")
        const pairs = await Promise.all(
          needSigning.map(async (r) => {
            try {
              const path = r.image_cloud_path as string
              const url = `${baseUrl}/signed?file=${encodeURIComponent(path)}&ttl=300`
              const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
              })
              const data = (await res.json()) as { url?: string }
              return [r.collection_item_id, data.url ?? null] as const
            } catch {
              return [r.collection_item_id, null] as const
            }
          })
        )
        const urlByItemId = new Map<string, string | null>(pairs)
        for (const r of raw) r.image_url = urlByItemId.get(r.collection_item_id) ?? null
        for (const r of gradedRows)
          r.image_url = urlByItemId.get(r.collection_item_id) ?? null
      }
    }

    // Ignore out-of-date runs (fast toggling)
    if (roiRunRef.current !== runId) return

    setRoiRawTop(raw)
    setRoiGradedTop(gradedRows)
    setRoiSortApplied(roiSort)
    setRoiRowsAnimKey((n) => n + 1)
    setRoiLoading(false)
  }, [user?.id, workerOrigin, dashboardRange, roiSort])

  useEffect(() => {
    void refreshLedger()
  }, [refreshLedger, balanceReloadKey])

  useEffect(() => {
    void refreshRoi()
  }, [refreshRoi, balanceReloadKey])

  useEffect(() => {
    void refreshCollectionCount()
  }, [refreshCollectionCount, balanceReloadKey])

  const initials = useMemo(() => {
    const email = user?.email ?? ""
    const trimmed = email.trim()
    if (!trimmed) return "U"
    return trimmed.slice(0, 2).toUpperCase()
  }, [user?.email])

  async function handleSignOut() {
    await supabase.auth.signOut()
    clearAuth()
    navigate({ to: "/auth/login" })
  }

  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-left">
            <h1 className="truncate text-xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back{user?.email ? `, ${user.email}` : ""}.
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="p-1">
                <Avatar className="size-9">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                {user?.email ?? "Account"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate({ to: "/user/dashboard" })}
              >
                <Settings data-icon="inline-start" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut data-icon="inline-start" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator className="my-6" />

        <div className="grid grid-cols-12 gap-3">
          <GridGroup className="h-full sm:col-span-4 md:col-span-4 lg:col-span-3">
            <Button
              type="button"
              className="shine-button-light relative col-span-12 h-full min-h-28 w-full items-stretch border border-border/80 bg-white p-6 text-black shadow-sm hover:bg-neutral-100 active:translate-y-px"
              onClick={() => navigate({ to: "/user/my-collection" })}
            >
              <Folder aria-hidden="true" className="absolute left-5 top-5 size-7" />
              <span
                className="absolute right-5 top-5 flex min-h-7 min-w-7 items-center justify-center rounded-full bg-neutral-900 px-2 text-xs font-semibold tabular-nums text-white shadow-sm ring-2 ring-white"
                aria-label={
                  collectionCount === null
                    ? "Collection item count loading"
                    : `${collectionCount} items in collection`
                }
              >
                {collectionCount === null ? (
                  <span className="inline-block size-3 animate-pulse rounded-full bg-white/40" />
                ) : (
                  collectionCount
                )}
              </span>
              <span className="absolute bottom-5 right-5 text-right text-2xl font-semibold leading-none lg:text-xl">
                My Collection
              </span>
            </Button>
          </GridGroup>

          <GridGroup className="h-full auto-rows-fr sm:col-span-4 md:col-span-4 lg:col-span-3">
            <Button
              type="button"
              className="shine-button-light relative col-span-6 h-full min-h-28 w-full items-stretch border border-border/80 bg-white p-6 text-black shadow-sm hover:bg-neutral-100 active:translate-y-px sm:col-span-12 md:col-span-6 lg:col-span-6"
              onClick={() => setBuyChooserOpen(true)}
            >
              <ShoppingCart aria-hidden="true" className="absolute left-5 top-5 size-7" />
              <span className="absolute bottom-5 right-5 text-right text-2xl font-semibold leading-none lg:text-xl">
                Buy
              </span>
            </Button>
            <Button
              type="button"
              className="shine-button-light relative col-span-6 h-full min-h-28 w-full items-stretch border border-border/80 bg-white p-6 text-black shadow-sm hover:bg-neutral-100 active:translate-y-px sm:col-span-12 md:col-span-6 lg:col-span-6"
              onClick={() => setSellChooseOpen(true)}
            >
              <HandCoins aria-hidden="true" className="absolute left-5 top-5 size-7" />
              <span className="absolute bottom-5 right-5 text-right text-2xl font-semibold leading-none lg:text-xl">
                Sell
              </span>
            </Button>

            <Button
              type="button"
              className="shine-button relative hidden col-span-12 h-full min-h-28 w-full items-stretch border border-white/10 bg-black p-6 text-white shadow-sm hover:bg-neutral-900 active:translate-y-px md:block"
              onClick={() => setMiscOpen(true)}
            >
              <CreditCard aria-hidden="true" className="absolute left-5 top-5 size-7" />
              <span className="absolute bottom-5 right-5 text-right text-2xl font-semibold leading-none lg:text-xl">
                Miscellaneous
              </span>
            </Button>
          </GridGroup>

          <GridGroup className="h-full sm:col-span-4 md:hidden">
            <Button
              type="button"
              className="shine-button relative col-span-12 h-full min-h-28 w-full items-stretch border border-white/10 bg-black p-6 text-white shadow-sm hover:bg-neutral-900 active:translate-y-px"
              onClick={() => setMiscOpen(true)}
            >
              <CreditCard aria-hidden="true" className="absolute left-5 top-5 size-7" />
              <span className="absolute bottom-5 right-5 text-right text-2xl font-semibold leading-none lg:text-xl">
                Miscellaneous
              </span>
            </Button>
          </GridGroup>

          <section className="col-span-12 grid h-full grid-cols-12 gap-3 md:col-span-4 md:[grid-template-rows:auto_1fr] lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:auto-rows-fr lg:[grid-template-rows:1fr]">
            <div className="col-span-12 sm:col-span-6 md:col-span-12 lg:col-span-6">
              <TotalBalanceCard
                loading={ledgerLoading}
                error={ledgerError}
                totalBalanceHKD={totalBalanceHKD}
                animatedBalance={animatedBalance}
                onOpenLedger={() => navigate({ to: "/user/ledger" as any })}
              />
            </div>

            <div className="col-span-12 sm:col-span-6 md:col-span-12 lg:col-span-6">
              <BalanceChangeCard
                loading={ledgerLoading}
                error={ledgerError}
                totalBalanceHKD={totalBalanceHKD}
                totalBalanceAgoHKD={totalBalanceAgoHKD}
                compareLabel={
                  dashboardRange === "365"
                    ? "1 year"
                    : dashboardRange === "180"
                      ? "6 months"
                      : "3 months"
                }
                notAvailable={dashboardRange === "all"}
                range={dashboardRange}
                onRangeChange={(v) => setDashboardRange(v)}
              />
            </div>
          </section>

          <Dialog open={buyChooserOpen} onOpenChange={setBuyChooserOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Buy</DialogTitle>
                <DialogDescription>Choose how you want to add this purchase.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-28 flex-col items-center justify-center gap-2 text-center"
                  onClick={() => {
                    setBuyChooserOpen(false)
                    setBuyOpen(true)
                  }}
                >
                  <PlusSquare aria-hidden="true" className="size-9" />
                  <span className="whitespace-normal break-words text-sm font-medium leading-tight">
                    Create New
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-28 flex-col items-center justify-center gap-2 text-center"
                  onClick={() => {
                    setBuyChooserOpen(false)
                    // TODO: hook up Card Base chooser
                    setCardBaseOpen(true)
                  }}
                >
                  <LayoutGrid aria-hidden="true" className="size-9" />
                  <span className="whitespace-normal break-words text-sm font-medium leading-tight">
                    Choose from my Card Base
                  </span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <BuyProductDialog
            open={buyOpen}
            onOpenChange={setBuyOpen}
            onSubmitSuccess={() => setBalanceReloadKey((n) => n + 1)}
          />
          <CardBaseDialog
            open={cardBaseOpen}
            onOpenChange={setCardBaseOpen}
            onSelect={(item) => {
              setSelectedCardBaseItem(item)
              setBuyByCardBaseOpen(true)
            }}
          />
          <BuyProductByCardBaseDialog
            open={buyByCardBaseOpen}
            onOpenChange={setBuyByCardBaseOpen}
            item={selectedCardBaseItem}
            onSubmitSuccess={() => setBalanceReloadKey((n) => n + 1)}
          />
          <SellChooseItemDialog
            open={sellChooseOpen}
            onOpenChange={setSellChooseOpen}
            onSelect={(choice) => {
              setSellChoice(choice)
              setSellInfoOpen(true)
            }}
          />
          <SellInfoDialog
            open={sellInfoOpen}
            onOpenChange={setSellInfoOpen}
            choice={sellChoice}
            onBack={() => {
              setSellInfoOpen(false)
              setSellChooseOpen(true)
            }}
            onSubmitted={() => {
              setSellChoice(null)
              setBalanceReloadKey((n) => n + 1)
            }}
          />
          <MiscellaneousEntryDialog
            open={miscOpen}
            onOpenChange={setMiscOpen}
            onSubmitted={() => setBalanceReloadKey((n) => n + 1)}
          />

          <ViewportDeferred
            className="col-span-12"
            fallback={
              <div
                className="min-h-[min(420px,70dvh)] rounded-xl bg-muted/20 ring-1 ring-border/50 animate-pulse"
                aria-hidden
              />
            }
          >
            <div className="grid grid-cols-12 gap-3">
              <RoiSection
                roiError={roiError}
                roiLoading={roiLoading}
                rowsAnimKey={roiRowsAnimKey}
                range={dashboardRange}
                onRangeChange={(v) => {
                  setRoiLoading(true)
                  setDashboardRange(v)
                }}
                roiSort={roiSort}
                setRoiSort={(v) => {
                  setRoiLoading(true)
                  setRoiSort(v)
                }}
                roiSortApplied={roiSortApplied}
                roiRawTop={roiRawTop}
                roiGradedTop={roiGradedTop}
                roiExpandedKey={roiExpandedKey}
                setRoiExpandedKey={setRoiExpandedKey}
              />
            </div>
          </ViewportDeferred>

          <ViewportDeferred
            className="col-span-12"
            fallback={
              <div
                className="min-h-[300px] rounded-xl bg-muted/20 ring-1 ring-border/50 animate-pulse"
                aria-hidden
              />
            }
          >
            <div className="grid grid-cols-12 gap-3">
              <SpendingPieSection
                range={dashboardRange}
                onRangeChange={(v) => setDashboardRange(v)}
                loading={ledgerLoading}
                error={ledgerError}
                buyTotal={flowTotals.buy}
                sellTotal={flowTotals.sell}
                miscTotal={flowTotals.misc}
              />

              <ActivityTrendSection
                range={dashboardRange}
                onRangeChange={(v) => setDashboardRange(v)}
                loading={ledgerLoading}
                error={ledgerError}
                points={activityTrendPoints}
              />
            </div>
          </ViewportDeferred>

          <ViewportDeferred
            className="col-span-12"
            fallback={
              <div
                className="min-h-[320px] rounded-xl bg-muted/20 ring-1 ring-border/50 animate-pulse"
                aria-hidden
              />
            }
          >
            <div className="grid grid-cols-12 gap-3">
              <GameTitleSpendingPieSection
                range={dashboardRange}
                onRangeChange={(v) => setDashboardRange(v)}
                loading={ledgerLoading}
                error={ledgerError}
                slices={gameTitleSlices}
              />

              <GameTitleGainingPieSection
                range={dashboardRange}
                onRangeChange={(v) => setDashboardRange(v)}
                loading={ledgerLoading}
                error={ledgerError}
                slices={gameTitleGainingSlices}
              />
            </div>
          </ViewportDeferred>
        </div>
      </div>
    </main>
  )
}

