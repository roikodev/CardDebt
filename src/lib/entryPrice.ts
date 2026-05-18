/** Parses HKD entry price for user_collection.entry_price. */
export function parseEntryPrice(value: string | undefined | null): number {
  const n = Number(String(value ?? "").trim())
  if (!Number.isFinite(n) || n < 0) return NaN
  return n
}

export function isValidEntryPrice(value: string | undefined | null): boolean {
  return !Number.isNaN(parseEntryPrice(value))
}
