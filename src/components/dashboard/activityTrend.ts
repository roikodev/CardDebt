import type { DashboardTimeRange } from "@/components/dashboard/TimeRangeFilter"

import { daysAgoISODate } from "./utils"

export type ActivityTrendPoint = {
  label: string
  /** Cumulative buy spending (HKD) */
  buyCum: number
  /** Cumulative sell proceeds (HKD) */
  sellCum: number
  /** Cumulative miscellaneous cost (HKD) */
  miscCum: number
}

function normalizeDay(s: string | null | undefined): string | null {
  if (!s) return null
  const t = String(s).trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}

function todayISO(): string {
  return daysAgoISODate(0)
}

function enumerateDays(start: string, end: string): string[] {
  if (start > end) return []
  const out: string[] = []
  const cur = new Date(`${start}T12:00:00`)
  const endT = new Date(`${end}T12:00:00`)
  while (cur.getTime() <= endT.getTime()) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, "0")
    const d = String(cur.getDate()).padStart(2, "0")
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function diffDaysInclusive(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`).getTime()
  const b = new Date(`${end}T12:00:00`).getTime()
  return Math.floor((b - a) / 86400000) + 1
}

function enumerateMonthKeys(fromYM: string, toYM: string): string[] {
  const out: string[] = []
  let y = Number(fromYM.slice(0, 4))
  let m = Number(fromYM.slice(5, 7))
  const endY = Number(toYM.slice(0, 4))
  const endM = Number(toYM.slice(5, 7))
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

function formatMonthLabel(ym: string): string {
  const [y, mo] = ym.split("-").map(Number)
  const d = new Date(y, mo - 1, 1)
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" })
}

function formatDayLabel(day: string): string {
  const [y, mo, da] = day.split("-").map(Number)
  const d = new Date(y, mo - 1, da)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function minDateStrings(dates: string[]): string | null {
  if (!dates.length) return null
  let m = dates[0]
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < m) m = dates[i]
  }
  return m
}

function buyOrSellAmount(row: {
  price_hkd?: unknown
  quantity?: unknown
}): number {
  const price = Number(row.price_hkd ?? 0)
  const qty = Number(row.quantity ?? 0)
  if (!Number.isFinite(price) || !Number.isFinite(qty)) return 0
  return price * qty
}

function miscAmount(row: { price?: unknown }): number {
  const p = Number(row.price ?? 0)
  return Number.isFinite(p) ? p : 0
}

/**
 * Cumulative **HKD** in the window: buys = Σ(price×qty), sells = Σ(price×qty), misc = Σ(price).
 */
export function buildCumulativeActivitySeries(
  range: DashboardTimeRange,
  buys: Array<{ purchase_date?: string | null; price_hkd?: unknown; quantity?: unknown }>,
  sells: Array<{ selling_date?: string | null; price_hkd?: unknown; quantity?: unknown }>,
  misc: Array<{ date?: string | null; price?: unknown }>
): ActivityTrendPoint[] {
  const end = todayISO()

  const buyDays: string[] = []
  for (const row of buys) {
    const d = normalizeDay(row.purchase_date ?? null)
    if (d) buyDays.push(d)
  }
  const sellDays: string[] = []
  for (const row of sells) {
    const d = normalizeDay(row.selling_date ?? null)
    if (d) sellDays.push(d)
  }
  const miscDays: string[] = []
  for (const row of misc) {
    const d = normalizeDay(row.date ?? null)
    if (d) miscDays.push(d)
  }

  let start: string
  if (range === "all") {
    const earliest = minDateStrings([...buyDays, ...sellDays, ...miscDays])
    start = earliest ?? end
    if (start > end) start = end
  } else {
    const days = range === "365" ? 365 : range === "180" ? 180 : 90
    start = daysAgoISODate(days)
  }

  if (start > end) {
    return [
      {
        label: formatDayLabel(end),
        buyCum: 0,
        sellCum: 0,
        miscCum: 0,
      },
    ]
  }

  const spanDays = diffDaysInclusive(start, end)
  const useMonthly = range === "all" && spanDays > 366

  if (useMonthly) {
    const fromYM = start.slice(0, 7)
    const toYM = end.slice(0, 7)
    const months = enumerateMonthKeys(fromYM, toYM)

    const buyPerMonth = new Map<string, number>()
    const sellPerMonth = new Map<string, number>()
    const miscPerMonth = new Map<string, number>()

    for (const row of buys) {
      const d = normalizeDay(row.purchase_date ?? null)
      if (!d || d < start || d > end) continue
      const mk = d.slice(0, 7)
      const amt = buyOrSellAmount(row)
      buyPerMonth.set(mk, (buyPerMonth.get(mk) ?? 0) + amt)
    }
    for (const row of sells) {
      const d = normalizeDay(row.selling_date ?? null)
      if (!d || d < start || d > end) continue
      const mk = d.slice(0, 7)
      const amt = buyOrSellAmount(row)
      sellPerMonth.set(mk, (sellPerMonth.get(mk) ?? 0) + amt)
    }
    for (const row of misc) {
      const d = normalizeDay(row.date ?? null)
      if (!d || d < start || d > end) continue
      const mk = d.slice(0, 7)
      const amt = miscAmount(row)
      miscPerMonth.set(mk, (miscPerMonth.get(mk) ?? 0) + amt)
    }

    let cb = 0
    let cs = 0
    let cm = 0
    const points: ActivityTrendPoint[] = []
    for (const mk of months) {
      cb += buyPerMonth.get(mk) ?? 0
      cs += sellPerMonth.get(mk) ?? 0
      cm += miscPerMonth.get(mk) ?? 0
      points.push({
        label: formatMonthLabel(mk),
        buyCum: cb,
        sellCum: cs,
        miscCum: cm,
      })
    }
    return points.length
      ? points
      : [{ label: formatDayLabel(end), buyCum: 0, sellCum: 0, miscCum: 0 }]
  }

  const buyPerDay = new Map<string, number>()
  const sellPerDay = new Map<string, number>()
  const miscPerDay = new Map<string, number>()

  for (const row of buys) {
    const d = normalizeDay(row.purchase_date ?? null)
    if (!d || d < start || d > end) continue
    const amt = buyOrSellAmount(row)
    buyPerDay.set(d, (buyPerDay.get(d) ?? 0) + amt)
  }
  for (const row of sells) {
    const d = normalizeDay(row.selling_date ?? null)
    if (!d || d < start || d > end) continue
    const amt = buyOrSellAmount(row)
    sellPerDay.set(d, (sellPerDay.get(d) ?? 0) + amt)
  }
  for (const row of misc) {
    const d = normalizeDay(row.date ?? null)
    if (!d || d < start || d > end) continue
    const amt = miscAmount(row)
    miscPerDay.set(d, (miscPerDay.get(d) ?? 0) + amt)
  }

  const days = enumerateDays(start, end)
  let cb = 0
  let cs = 0
  let cm = 0
  const points: ActivityTrendPoint[] = []
  for (const day of days) {
    cb += buyPerDay.get(day) ?? 0
    cs += sellPerDay.get(day) ?? 0
    cm += miscPerDay.get(day) ?? 0
    points.push({
      label: formatDayLabel(day),
      buyCum: cb,
      sellCum: cs,
      miscCum: cm,
    })
  }
  return points
}
