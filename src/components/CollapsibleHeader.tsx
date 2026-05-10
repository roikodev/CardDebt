import { useEffect, useMemo, useRef, useState } from "react"

export type UseCollapsibleHeaderArgs = {
  /**
   * Optional fixed header height in px.
   * If omitted, height is measured from the rendered header element.
   */
  heightPx?: number
  /**
   * How many px of scroll it takes to fully collapse.
   * Default: headerHeight
   */
  collapseDistancePx?: number
  /**
   * Animation mode.
   * - "dom": updates CSS variables on the header container (no React re-render on scroll)
   * - "react": uses React state for animatedStyle (simpler, but re-renders on scroll)
   */
  mode?: "dom" | "react"
}

export function useCollapsibleHeader(args: UseCollapsibleHeaderArgs = {}) {
  const { heightPx, collapseDistancePx, mode = "dom" } = args

  const containerRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastYRef = useRef(0)
  const offsetRef = useRef(0)

  const [headerHeight, setHeaderHeight] = useState(heightPx ?? 0)
  const [offset, setOffset] = useState(0) // only used in "react" mode

  useEffect(() => {
    if (typeof heightPx === "number") {
      setHeaderHeight(heightPx)
      return
    }

    const el = headerRef.current
    if (!el) return

    const update = () => setHeaderHeight(el.getBoundingClientRect().height)
    update()

    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [heightPx])

  // Ensure initial style is applied in DOM mode.
  useEffect(() => {
    if (mode !== "dom") return
    const el = containerRef.current
    if (!el) return
    el.style.setProperty("--ch-y", "0px")
    el.style.setProperty("--ch-o", "1")
  }, [mode])

  const onScroll = (scrollTop: number) => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      // iOS rubber-banding can report negative scrollTop while bouncing.
      // We never want that to drive a "collapse" (fade out / move up).
      // When y <= 0: keep header fully visible at rest (offset = 0).
      const y = Math.max(0, scrollTop)
      const dy = y - lastYRef.current
      lastYRef.current = y

      const max = Math.max(0, collapseDistancePx ?? headerHeight)
      const next = offsetRef.current + dy
      const clamped = Math.min(Math.max(next, 0), max)
      offsetRef.current = clamped

      if (mode === "react") {
        setOffset(clamped)
        return
      }

      const el = containerRef.current
      if (!el) return

      const denom = Math.max(1, max || 1)
      const p = Math.min(1, Math.max(0, clamped / denom))
      el.style.setProperty("--ch-y", `${-clamped}px`)
      el.style.setProperty("--ch-o", String(1 - p))
    })
  }

  const animatedStyle = useMemo(() => {
    const max = Math.max(1, (collapseDistancePx ?? headerHeight) || 1)
    const p = Math.min(1, Math.max(0, offset / max))
    return {
      transform: `translateY(${-offset}px)`,
      opacity: 1 - p,
    } as const
  }, [collapseDistancePx, headerHeight, offset])

  return {
    containerRef,
    headerRef,
    headerHeight,
    onScroll,
    animatedStyle: mode === "react" ? animatedStyle : null,
    headerOffset: mode === "react" ? offset : offsetRef.current,
  }
}

type Props = {
  containerRef?: React.RefObject<HTMLDivElement | null>
  headerRef?: React.RefObject<HTMLElement | null>
  height: number
  animatedStyle?: { transform: string; opacity: number } | null
  left?: React.ReactNode
  title?: React.ReactNode
  right?: React.ReactNode
}

export function CollapsibleHeader({
  containerRef,
  headerRef,
  height,
  animatedStyle,
  left,
  title,
  right,
}: Props) {
  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute left-0 right-0 top-0 z-20 border-b bg-background/80 backdrop-blur"
      style={{
        height,
        transform: animatedStyle?.transform ?? "translateY(var(--ch-y, 0px))",
        opacity: (animatedStyle?.opacity ?? "var(--ch-o, 1)") as any,
      }}
    >
      <header ref={headerRef} className="pointer-events-auto px-4 py-6">
        <div className="flex items-center gap-4">
          <div className="shrink-0">{left}</div>
          <div className="min-w-0 flex-1">{title}</div>
        </div>
        {right ? <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">{right}</div> : null}
      </header>
    </div>
  )
}

