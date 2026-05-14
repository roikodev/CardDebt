import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth"
import { useNavigate } from "@tanstack/react-router"
import {
  CreditCard,
  Folder,
  HandCoins,
  ImagePlus,
  LayoutGrid,
  LogOut,
  PlusSquare,
  Settings,
  ShoppingCart,
  Sparkles,
} from "lucide-react"

function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** Re-encode any supported `data:image/...` as JPEG for APIs that expect JPEG data URLs. */
async function dataUrlToJpegDataUrl(
  dataUrl: string,
  maxDim: number,
  quality: number
): Promise<string> {
  const img = new Image()
  img.decoding = "async"
  img.loading = "eager"
  img.src = dataUrl
  await img.decode()
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height || 1))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext("2d")
  if (!g) throw new Error("No 2d context")
  g.drawImage(img, 0, 0, w, h)
  const jpeg = canvas.toDataURL("image/jpeg", quality)
  if (!jpeg.startsWith("data:image/jpeg")) throw new Error("JPEG encode failed")
  return jpeg
}

/** Strip `data:*;base64,` — Edge Function expects raw payload in `imageBase64`. */
function dataUrlToRawBase64(dataUrl: string): string | null {
  const comma = dataUrl.indexOf(",")
  if (comma !== -1 && /;base64$/i.test(dataUrl.slice(0, comma))) {
    return dataUrl.slice(comma + 1)
  }
  const trimmed = dataUrl.trim()
  if (trimmed.length >= 100 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    return trimmed.replace(/\s/g, "")
  }
  return null
}

function formatSupabaseFunctionError(error: unknown): string {
  const anyErr = error as {
    message?: string
    name?: string
    context?: { status?: number; statusText?: string; body?: unknown }
  }
  const status = anyErr?.context?.status
  const statusText = anyErr?.context?.statusText
  const body = anyErr?.context?.body
  return [
    status ? `HTTP ${status}${statusText ? ` ${statusText}` : ""}` : null,
    anyErr?.name ? `${anyErr.name}` : null,
    anyErr?.message ? `${anyErr.message}` : String(error),
    body
      ? `Response body: ${typeof body === "string" ? body : JSON.stringify(body)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n")
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
  const [askAiOpen, setAskAiOpen] = useState(false)
  /** Original data URL from the selected file (highest fidelity). */
  const [askAiImageOriginalDataUrl, setAskAiImageOriginalDataUrl] = useState<
    string | null
  >(null)
  /** Compressed JPEG data URL; raw base64 is derived for `research-card-price`. */
  const [askAiImageSendDataUrl, setAskAiImageSendDataUrl] = useState<string | null>(
    null
  )
  /** Optional compressed preview (may match send payload). */
  const [askAiImagePreviewDataUrl, setAskAiImagePreviewDataUrl] = useState<string | null>(
    null
  )
  /** Pretty JSON / text from `research-card-price` (`answer`). */
  const [askAiResearchAnswer, setAskAiResearchAnswer] = useState<string | null>(
    null
  )
  const [askAiResearchResponseId, setAskAiResearchResponseId] = useState<
    string | null
  >(null)
  const [askAiError, setAskAiError] = useState<string | null>(null)
  const [askAiLoading, setAskAiLoading] = useState(false)
  const askAiFileInputRef = useRef<HTMLInputElement | null>(null)
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

  useEffect(() => {
    const cls = "carddebt-dashboard-hide-scrollbar"
    document.documentElement.classList.add(cls)
    document.body.classList.add(cls)
    return () => {
      document.documentElement.classList.remove(cls)
      document.body.classList.remove(cls)
    }
  }, [])

  const initials = useMemo(() => {
    const email = user?.email ?? ""
    const trimmed = email.trim()
    if (!trimmed) return "U"
    return trimmed.slice(0, 2).toUpperCase()
  }, [user?.email])

  const handleAskAiImagePick = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith("image/")) {
        setAskAiError("Please choose an image file (JPEG, PNG, WebP, etc.).")
        setAskAiImageOriginalDataUrl(null)
        setAskAiImageSendDataUrl(null)
        setAskAiImagePreviewDataUrl(null)
        return
      }
      const maxBytes = 8 * 1024 * 1024
      if (file.size > maxBytes) {
        setAskAiError("Image must be 8 MB or smaller.")
        setAskAiImageOriginalDataUrl(null)
        setAskAiImageSendDataUrl(null)
        setAskAiImagePreviewDataUrl(null)
        return
      }
      setAskAiError(null)
      setAskAiImageSendDataUrl(null)
      setAskAiImagePreviewDataUrl(null)
      const reader = new FileReader()
      reader.onload = async () => {
        const result = reader.result
        if (typeof result !== "string" || !result.startsWith("data:image/")) {
          setAskAiError("Could not read image as a data URL.")
          setAskAiImageOriginalDataUrl(null)
          setAskAiImageSendDataUrl(null)
          setAskAiImagePreviewDataUrl(null)
          return
        }

        // 1) Store the original immediately.
        setAskAiImageOriginalDataUrl(result)

        // 2) Compress to JPEG (server wraps bytes as data:image/jpeg;base64,...).
        try {
          const jpeg = await dataUrlToJpegDataUrl(result, 1600, 0.92)
          setAskAiImageSendDataUrl(jpeg)
          setAskAiImagePreviewDataUrl(jpeg)
        } catch {
          // Fall back to original; submit will try JPEG re-encode before research.
          setAskAiImageSendDataUrl(result)
          setAskAiImagePreviewDataUrl(result)
        }
      }
      reader.onerror = () => {
        setAskAiError("Failed to read the file.")
        setAskAiImageOriginalDataUrl(null)
        setAskAiImageSendDataUrl(null)
        setAskAiImagePreviewDataUrl(null)
      }
      reader.readAsDataURL(file)
    },
    []
  )

  const handleAskAiSubmit = useCallback(async () => {
    const raw = askAiImageSendDataUrl ?? askAiImageOriginalDataUrl
    if (!raw || !raw.startsWith("data:image/")) {
      setAskAiError("Choose a card image first.")
      return
    }
    setAskAiLoading(true)
    setAskAiError(null)
    setAskAiResearchAnswer(null)
    setAskAiResearchResponseId(null)
    try {
      let jpegDataUrl = raw
      if (!jpegDataUrl.startsWith("data:image/jpeg")) {
        try {
          jpegDataUrl = await dataUrlToJpegDataUrl(raw, 1600, 0.92)
        } catch {
          setAskAiError(
            "Could not convert the image to JPEG for research-card-price."
          )
          return
        }
      }

      const imageBase64 = dataUrlToRawBase64(jpegDataUrl)
      if (!imageBase64 || imageBase64.length < 100) {
        setAskAiError(
          "Could not derive JPEG base64 from the image (payload too small or invalid)."
        )
        return
      }

      const { data, error } = await supabase.functions.invoke(
        "research-card-price",
        { body: { imageBase64 } }
      )
      if (error) {
        setAskAiError(formatSupabaseFunctionError(error))
        return
      }
      if (data === null || data === undefined) {
        setAskAiError("research-card-price returned an empty response.")
        return
      }
      if (typeof data === "object" && data !== null && "error" in data) {
        const msg = (data as { error?: string }).error
        if (msg) {
          setAskAiError(String(msg))
          return
        }
      }
      if (typeof data === "object" && data !== null) {
        const rid = (data as { response_id?: unknown }).response_id
        if (typeof rid === "string" && rid) setAskAiResearchResponseId(rid)
        if ("answer" in data) {
          const answer = (data as { answer?: unknown }).answer
          if (typeof answer === "string") {
            setAskAiResearchAnswer(answer)
            return
          }
          if (answer !== null && typeof answer === "object") {
            setAskAiResearchAnswer(JSON.stringify(answer, null, 2))
            return
          }
        }
      }
      setAskAiResearchAnswer(
        typeof data === "string" ? data : JSON.stringify(data, null, 2)
      )
    } catch (e) {
      setAskAiError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setAskAiLoading(false)
    }
  }, [askAiImageOriginalDataUrl, askAiImageSendDataUrl])

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
            <div className="col-span-12 grid grid-cols-1 gap-3">
              <Button
                type="button"
                variant="ghost"
                className="ask-ai-siri-button relative col-span-1 !h-full min-h-28 w-full justify-stretch rounded-2xl border-0 bg-transparent p-6 text-white shadow-none hover:bg-transparent dark:hover:bg-transparent active:translate-y-px focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => setAskAiOpen(true)}
              >
                <span className="ask-ai-siri-aurora" aria-hidden>
                  <span className="ask-ai-siri-orb ask-ai-siri-orb-a" />
                  <span className="ask-ai-siri-orb ask-ai-siri-orb-b" />
                  <span className="ask-ai-siri-orb ask-ai-siri-orb-c" />
                </span>
                <span className="ask-ai-siri-glass" aria-hidden />
                <Sparkles
                  aria-hidden="true"
                  className="absolute left-5 top-5 z-10 size-7 text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.45)]"
                />
                <span className="absolute bottom-5 right-5 z-10 text-right text-2xl font-semibold leading-none tracking-tight text-white drop-shadow-sm lg:text-xl">
                  Ask AI
                </span>
              </Button>
              <Button
                type="button"
                className="shine-button-light relative col-span-1 h-full min-h-28 w-full items-stretch border border-border/80 bg-white p-6 text-black shadow-sm hover:bg-neutral-100 active:translate-y-px"
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
            </div>
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
            <DialogContent className="min-w-0 sm:max-w-md">
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

          <Dialog
            open={askAiOpen}
            onOpenChange={(open) => {
              setAskAiOpen(open)
              if (!open) {
                setAskAiLoading(false)
                setAskAiError(null)
                setAskAiResearchAnswer(null)
                setAskAiResearchResponseId(null)
                setAskAiImageOriginalDataUrl(null)
                setAskAiImageSendDataUrl(null)
                setAskAiImagePreviewDataUrl(null)
                if (askAiFileInputRef.current) askAiFileInputRef.current.value = ""
              }
            }}
          >
            <DialogContent className="flex max-h-[min(90dvh,85vh)] min-h-0 min-w-0 w-full max-w-lg flex-col gap-0 p-0 sm:max-w-xl">
              <DialogHeader className="shrink-0 px-4 pt-4 pr-12 sm:px-6 sm:pt-6">
                <DialogTitle>Ask AI</DialogTitle>
                <DialogDescription>
                  Calls{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    research-card-price
                  </code>{" "}
                  with JPEG <code className="text-[0.65rem]">imageBase64</code> (raw base64, no{" "}
                  <code className="text-[0.65rem]">data:</code> prefix). Response includes{" "}
                  <code className="text-[0.65rem]">answer</code>.
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="flex min-h-0 flex-col gap-4 px-4 sm:px-6">
                <div className="space-y-2">
                  <Label htmlFor="ask-ai-image">Card image</Label>
                  <input
                    ref={askAiFileInputRef}
                    id="ask-ai-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                    className="sr-only"
                    disabled={askAiLoading}
                    onChange={handleAskAiImagePick}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={askAiLoading}
                      onClick={() => askAiFileInputRef.current?.click()}
                    >
                      <ImagePlus className="size-4" aria-hidden />
                      Choose image
                    </Button>
                    {askAiImageOriginalDataUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={askAiLoading}
                        onClick={() => {
                          setAskAiImageOriginalDataUrl(null)
                          setAskAiImageSendDataUrl(null)
                          setAskAiImagePreviewDataUrl(null)
                          setAskAiResearchAnswer(null)
                          setAskAiResearchResponseId(null)
                          setAskAiError(null)
                          if (askAiFileInputRef.current) askAiFileInputRef.current.value = ""
                        }}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  {askAiImageOriginalDataUrl ? (
                    <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
                      <img
                        src={askAiImagePreviewDataUrl ?? askAiImageSendDataUrl ?? askAiImageOriginalDataUrl}
                        alt="Selected card preview"
                        className="mx-auto max-h-48 w-full max-w-md object-contain"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      JPEG or PNG recommended. Max 8 MB. Compressed to JPEG in-browser before
                      sending.
                    </p>
                  )}
                </div>
                {askAiError ? (
                  <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive sm:text-sm">
                    {askAiError}
                  </p>
                ) : null}
                <div className="flex min-h-[12rem] flex-1 flex-col gap-2">
                  <Label htmlFor="ask-ai-response">
                    Result{" "}
                    <span className="font-normal text-muted-foreground">
                      (<code className="text-[0.65rem]">research-card-price</code> →{" "}
                      <code className="text-[0.65rem]">answer</code>)
                    </span>
                  </Label>
                  <div
                    id="ask-ai-response"
                    className="min-h-[12rem] flex-1 overflow-auto rounded-lg border border-border bg-muted/25 p-3 font-mono text-xs whitespace-pre-wrap sm:text-sm"
                  >
                    {askAiLoading ? (
                      <p className="text-muted-foreground">
                        Analyzing photo & searching live prices…
                      </p>
                    ) : askAiResearchAnswer !== null ? (
                      <>
                        {askAiResearchAnswer}
                        {askAiResearchResponseId ? (
                          <p className="mt-3 border-t border-border pt-2 text-[0.65rem] text-muted-foreground">
                            response_id: {askAiResearchResponseId}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-muted-foreground">
                        JSON (game_title, estimated_price, reasoning, …) appears here after you run
                        research.
                      </p>
                    )}
                  </div>
                </div>
              </DialogBody>
              <DialogFooter className="shrink-0 border-t px-4 py-3 sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAskAiOpen(false)}
                  disabled={askAiLoading}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleAskAiSubmit()}
                  disabled={askAiLoading || !(askAiImageSendDataUrl ?? askAiImageOriginalDataUrl)}
                >
                  {askAiLoading ? "Working…" : "Research price"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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

