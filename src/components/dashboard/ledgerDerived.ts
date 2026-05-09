import { buildCumulativeActivitySeries, type ActivityTrendPoint } from "@/components/dashboard/activityTrend"
import type { DashboardTimeRange } from "@/components/dashboard/TimeRangeFilter"

import { daysAgoISODate } from "./utils"

/** Matches Spending / Gaining pie and game-title pies */
export const GAME_TITLE_SLICE_COLORS = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#22c55e",
  "#f97316",
  "#06b6d4",
  "#e879f9",
] as const

export type LedgerBuyRow = {
  purchase_date?: string | null
  price_hkd?: unknown
  quantity?: unknown
  collection_base?:
    | { game_title?: string | null }
    | Array<{ game_title?: string | null }>
    | null
}

export type LedgerSellRow = {
  selling_date?: string | null
  price_hkd?: unknown
  quantity?: unknown
  user_collection?:
    | {
        collection_base?:
          | { game_title?: string | null }
          | Array<{ game_title?: string | null }>
          | null
      }
    | Array<{
        collection_base?:
          | { game_title?: string | null }
          | Array<{ game_title?: string | null }>
          | null
      }>
    | null
}

export type LedgerMiscRow = {
  date?: string | null
  price?: unknown
}

export type GameTitleSlice = { name: string; value: number; color: string }

export function isoCutoffForRange(range: DashboardTimeRange): string | null {
  if (range === "all") return null
  const days = range === "365" ? 365 : range === "180" ? 180 : 90
  return daysAgoISODate(days)
}

function lineAmountBuy(row: Pick<LedgerBuyRow, "price_hkd" | "quantity">): number {
  const price = Number(row.price_hkd ?? 0)
  const qty = Number(row.quantity ?? 0)
  if (!Number.isFinite(price) || !Number.isFinite(qty)) return 0
  return price * qty
}

function lineAmountSell(row: Pick<LedgerSellRow, "price_hkd" | "quantity">): number {
  return lineAmountBuy(row as Pick<LedgerBuyRow, "price_hkd" | "quantity">)
}

function lineAmountMisc(row: Pick<LedgerMiscRow, "price">): number {
  const p = Number(row.price ?? 0)
  return Number.isFinite(p) ? p : 0
}

/** Sum buys/sells/misc in the rolling window: rows with date on or after `cutoff` (when set). */
export function deriveFlowTotals(
  buys: LedgerBuyRow[],
  sells: LedgerSellRow[],
  misc: LedgerMiscRow[],
  range: DashboardTimeRange
): { buy: number; sell: number; misc: number } {
  const cutoff = isoCutoffForRange(range)

  let buy = 0
  for (const r of buys) {
    const d = String(r.purchase_date ?? "")
    if (cutoff && (!d || d < cutoff)) continue
    buy += lineAmountBuy(r)
  }

  let sell = 0
  for (const r of sells) {
    const d = String(r.selling_date ?? "")
    if (cutoff && (!d || d < cutoff)) continue
    sell += lineAmountSell(r)
  }

  let m = 0
  for (const r of misc) {
    const d = String(r.date ?? "")
    if (cutoff && (!d || d < cutoff)) continue
    m += lineAmountMisc(r)
  }

  return { buy, sell, misc: m }
}

/** Lifetime net balance: sells − buys − misc (all rows). */
export function deriveTotalBalanceHKD(
  buys: LedgerBuyRow[],
  sells: LedgerSellRow[],
  misc: LedgerMiscRow[]
): number {
  const buy = buys.reduce((s, r) => s + lineAmountBuy(r), 0)
  const sell = sells.reduce((s, r) => s + lineAmountSell(r), 0)
  const m = misc.reduce((s, r) => s + lineAmountMisc(r), 0)
  return sell - buy - m
}

/**
 * Net balance as of end of day `asOfISO` (only transactions on/before that date).
 */
export function deriveBalanceAsOfHKD(
  buys: LedgerBuyRow[],
  sells: LedgerSellRow[],
  misc: LedgerMiscRow[],
  asOfISO: string
): number {
  let buy = 0
  for (const r of buys) {
    const d = String(r.purchase_date ?? "").slice(0, 10)
    if (!d || d > asOfISO) continue
    buy += lineAmountBuy(r)
  }
  let sell = 0
  for (const r of sells) {
    const d = String(r.selling_date ?? "").slice(0, 10)
    if (!d || d > asOfISO) continue
    sell += lineAmountSell(r)
  }
  let m = 0
  for (const r of misc) {
    const d = String(r.date ?? "").slice(0, 10)
    if (!d || d > asOfISO) continue
    m += lineAmountMisc(r)
  }
  return sell - buy - m
}

/** Compare card: balance at the start of the comparison window. */
export function deriveCompareBalanceAgoHKD(
  buys: LedgerBuyRow[],
  sells: LedgerSellRow[],
  misc: LedgerMiscRow[],
  range: DashboardTimeRange
): number | null {
  if (range === "all") return null
  const compareDays = range === "90" ? 90 : range === "180" ? 180 : 365
  const asOf = daysAgoISODate(compareDays)
  return deriveBalanceAsOfHKD(buys, sells, misc, asOf)
}

function gameTitleFromBuyRow(r: LedgerBuyRow): string {
  const raw = r.collection_base
  const base = Array.isArray(raw) ? raw[0] : raw
  return (base?.game_title as string | null | undefined) ?? "Unknown"
}

function gameTitleFromSellRow(r: LedgerSellRow): string {
  const ucRaw = r.user_collection
  const uc = Array.isArray(ucRaw) ? ucRaw[0] : ucRaw
  const baseRaw = uc?.collection_base
  const base = Array.isArray(baseRaw) ? baseRaw[0] : baseRaw
  return (base?.game_title as string | null | undefined) ?? "Unknown"
}

export function deriveGameTitleSpendingSlices(
  buys: LedgerBuyRow[],
  range: DashboardTimeRange
): GameTitleSlice[] {
  const cutoff = isoCutoffForRange(range)
  const sums = new Map<string, number>()
  for (const r of buys) {
    const d = String(r.purchase_date ?? "")
    if (cutoff && (!d || d < cutoff)) continue
    const amt = lineAmountBuy(r)
    if (!amt) continue
    const title = gameTitleFromBuyRow(r)
    sums.set(title, (sums.get(title) ?? 0) + amt)
  }

  const sorted = Array.from(sums.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const top = sorted.slice(0, 8)
  const rest = sorted.slice(8)
  const other = rest.reduce((s, x) => s + x.value, 0)

  const slices: GameTitleSlice[] = top.map((x, i) => ({
    name: x.name,
    value: x.value,
    color: GAME_TITLE_SLICE_COLORS[i % GAME_TITLE_SLICE_COLORS.length],
  }))
  if (other > 0) {
    slices.push({ name: "Other", value: other, color: "#94a3b8" })
  }
  return slices
}

export function deriveGameTitleGainingSlices(
  sells: LedgerSellRow[],
  range: DashboardTimeRange
): GameTitleSlice[] {
  const cutoff = isoCutoffForRange(range)
  const sums = new Map<string, number>()
  for (const r of sells) {
    const d = String(r.selling_date ?? "")
    if (cutoff && (!d || d < cutoff)) continue
    const amt = lineAmountSell(r)
    if (!amt) continue
    const title = gameTitleFromSellRow(r)
    sums.set(title, (sums.get(title) ?? 0) + amt)
  }

  const sorted = Array.from(sums.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const top = sorted.slice(0, 8)
  const rest = sorted.slice(8)
  const other = rest.reduce((s, x) => s + x.value, 0)

  const slices: GameTitleSlice[] = top.map((x, i) => ({
    name: x.name,
    value: x.value,
    color: GAME_TITLE_SLICE_COLORS[i % GAME_TITLE_SLICE_COLORS.length],
  }))
  if (other > 0) {
    slices.push({ name: "Other", value: other, color: "#94a3b8" })
  }
  return slices
}

export function deriveActivityTrendPoints(
  range: DashboardTimeRange,
  buys: LedgerBuyRow[],
  sells: LedgerSellRow[],
  misc: LedgerMiscRow[]
): ActivityTrendPoint[] {
  return buildCumulativeActivitySeries(range, buys, sells, misc)
}
