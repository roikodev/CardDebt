import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Mounts `children` only after the wrapper intersects the viewport (optionally with margin).
 * Keeps content mounted after first show (`once`) so charts/lists don’t reset when scrolling away.
 */
export function ViewportDeferred({
  children,
  fallback,
  className,
  rootMargin = "180px 0px 240px 0px",
  once = true,
}: {
  children: ReactNode
  fallback?: ReactNode
  className?: string
  /** Expand the viewport for prefetch (CSS margin syntax). */
  rootMargin?: string
  /** If false, unmount when scrolled away (saves memory; may reset UI state). */
  once?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || (visible && once)) return

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          if (once) obs.disconnect()
        } else if (!once) {
          setVisible(false)
        }
      },
      { root: null, rootMargin, threshold: 0 }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [once, rootMargin, visible])

  return (
    <div
      ref={ref}
      className={cn("min-h-0", className)}
      aria-busy={!visible}
      data-viewport-deferred={visible ? "shown" : "pending"}
    >
      {visible ? (
        children
      ) : (
        fallback ?? (
          <div
            className="rounded-xl bg-muted/25 ring-1 ring-border/40 animate-pulse"
            aria-hidden
          />
        )
      )}
    </div>
  )
}
