import * as React from "react"

import { cn } from "@/lib/utils"

const TEMPORAL_INPUT_TYPES = new Set([
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
])

function isTemporalInputType(type: string | undefined): boolean {
  return type != null && TEMPORAL_INPUT_TYPES.has(type)
}

function openNativePicker(input: HTMLInputElement) {
  if (typeof input.showPicker !== "function") return
  try {
    input.showPicker()
  } catch {
    // Ignore when not allowed (e.g. not from a user gesture).
  }
}

function Input({ className, type, onClick, ...props }: React.ComponentProps<"input">) {
  const isTemporal = isTemporalInputType(type)

  return (
    <input
      type={type}
      data-slot="input"
      data-temporal={isTemporal ? "" : undefined}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        isTemporal
          ? "input-temporal min-h-11 h-11 appearance-none py-2 text-base touch-manipulation md:min-h-11 md:h-11 md:text-base"
          : "text-base md:text-sm",
        className
      )}
      onClick={(e) => {
        if (isTemporal) openNativePicker(e.currentTarget)
        onClick?.(e)
      }}
      {...props}
    />
  )
}

export { Input, isTemporalInputType }
