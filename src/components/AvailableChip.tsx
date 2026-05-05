type Props = {
  count: number
  tone?: "light" | "dark"
}

export function AvailableChip({ count, tone = "light" }: Props) {
  const toneClass =
    tone === "dark"
      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-50"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none shadow-sm ${toneClass}`}
    >
      Available x {count}
    </span>
  )
}

