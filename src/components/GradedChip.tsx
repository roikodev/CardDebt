type Props = {
  provider: string
  grade: number
  count?: number
  tone?: "light" | "dark"
  className?: string
}

export function GradedChip({ provider, grade, count, tone = "light", className }: Props) {
  const label = `${provider} ${grade}${typeof count === "number" ? `: ${count}` : ""}`
  const isPsa10 = provider === "PSA" && Number(grade) === 10
  const isPsa9 = provider === "PSA" && Number(grade) === 9

  const base =
    "shine-chip inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none"

  const variant = isPsa10
    ? "shine-chip-gold border-amber-300/70 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 text-amber-950 shadow-sm"
    : isPsa9
      ? "border-zinc-300/70 bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-100 text-zinc-900 shadow-sm"
      : tone === "dark"
        ? "border-white/15 bg-white/5 text-white shadow-sm"
        : "border-border bg-muted/50 text-foreground"

  return <span className={[base, variant, className ?? ""].join(" ").trim()}>{label}</span>
}

