type Props = {
  count: number
  tone?: "light" | "dark"
}

export function GradingChip({ count, tone = "light" }: Props) {
  const toneClass =
    tone === "dark"
      ? "border-white/15 bg-white/5 text-white"
      : "border-border bg-muted/50 text-foreground"

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none shadow-sm ${toneClass}`}
    >
      Grading: {count}
    </span>
  )
}

