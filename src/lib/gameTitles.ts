/**
 * Canonical `game_title` values (DB + APIs). Must stay aligned with Postgres CHECK.
 * Use `label` in UI; keep `value` for storage and form state.
 */
export const GAME_TITLE_VALUES = [
  "Pokémon TCG JP",
  "Pokémon TCG EN",
  "Pokémon TCG TC",
  "Yu-Gi-Oh! JP OCG",
  "Yu-Gi-Oh! EN TCG",
  "Battle Spirits",
] as const

export type GameTitleValue = (typeof GAME_TITLE_VALUES)[number]

export const GAME_TITLE_OPTIONS: readonly {
  value: GameTitleValue
  label: string
}[] = [
  { value: "Pokémon TCG JP", label: "Pokémon TCG — Japanese" },
  { value: "Pokémon TCG EN", label: "Pokémon TCG — English" },
  { value: "Pokémon TCG TC", label: "Pokémon TCG — Traditional Chinese" },
  { value: "Yu-Gi-Oh! JP OCG", label: "Yu-Gi-Oh! — OCG (Japan)" },
  { value: "Yu-Gi-Oh! EN TCG", label: "Yu-Gi-Oh! — TCG (English)" },
  { value: "Battle Spirits", label: "Battle Spirits" },
]

/** Tuple of values for zod `z.enum` and legacy includes checks. */
export const GAME_TITLES = GAME_TITLE_VALUES

const LEGACY_TO_CANONICAL: Record<string, GameTitleValue> = {
  "pokemon jp": "Pokémon TCG JP",
  "ygo ocg": "Yu-Gi-Oh! JP OCG",
  bs: "Battle Spirits",
}

/** UI label for a stored or model-returned title (canonical, legacy, or unknown). */
export function gameTitleDisplayText(storedOrModel: string | null | undefined): string {
  if (!storedOrModel?.trim()) return "—"
  const raw = storedOrModel.trim()
  const direct = GAME_TITLE_OPTIONS.find((o) => o.value === raw)
  if (direct) return direct.label
  const canon = LEGACY_TO_CANONICAL[raw.toLowerCase()]
  if (canon) {
    const opt = GAME_TITLE_OPTIONS.find((o) => o.value === canon)
    if (opt) return opt.label
  }
  return raw
}
