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
}

export function useCollapsibleHeader(args: UseCollapsibleHeaderArgs = {}) {
  const { heightPx, collapseDistancePx } = args

  const headerRef = useRef<HTMLElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastYRef = useRef(0)
  const offsetRef = useRef(0)

  const [headerHeight, setHeaderHeight] = useState(heightPx ?? 0)
  const [offset, setOffset] = useState(0)

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
      setOffset(clamped)
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
    headerRef,
    headerHeight,
    onScroll,
    animatedStyle,
    headerOffset: offset,
  }
}

type Props = {
  headerRef?: React.RefObject<HTMLElement | null>
  height: number
  animatedStyle: { transform: string; opacity: number }
  left?: React.ReactNode
  title?: React.ReactNode
  right?: React.ReactNode
}

export function CollapsibleHeader({
  headerRef,
  height,
  animatedStyle,
  left,
  title,
  right,
}: Props) {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-20 border-b bg-background/80 backdrop-blur"
      style={{
        height,
        transform: animatedStyle.transform,
        opacity: animatedStyle.opacity,
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

