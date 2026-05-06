import * as React from "react"
import { Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

import type { FormFieldRowProps } from "@/components/form-input/form-field-row"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

export type QuantityStepperProps = {
  id?: string
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  /** Forwarded to the center input for aria-invalid etc. */
  "aria-invalid"?: boolean
  /** Called after the field commits (e.g. pass `field.onBlur` from react-hook-form). */
  onBlur?: () => void
}

export function QuantityStepper({
  id,
  value,
  onValueChange,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  onBlur,
}: QuantityStepperProps) {
  const effectiveMin = min
  const effectiveMax = Math.max(min, max)

  const [focused, setFocused] = React.useState(false)
  const [text, setText] = React.useState(() => String(value))

  React.useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  const commitText = (s: string) => {
    if (s.trim() === "" || s === "-") {
      const v = clampInt(value, effectiveMin, effectiveMax)
      onValueChange(v)
      setText(String(v))
      return
    }
    const n = Number.parseInt(s, 10)
    if (!Number.isFinite(n)) {
      setText(String(value))
      return
    }
    const v = clampInt(n, effectiveMin, effectiveMax)
    onValueChange(v)
    setText(String(v))
  }

  const atMin = value <= effectiveMin
  const atMax = value >= effectiveMax

  const decrement = () =>
    onValueChange(clampInt(value - step, effectiveMin, effectiveMax))

  const increment = () =>
    onValueChange(clampInt(value + step, effectiveMin, effectiveMax))

  return (
    <div
      className={cn(
        "inline-flex w-max max-w-full min-w-0 items-stretch overflow-hidden rounded-lg border border-input bg-background shadow-xs",
        className
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-9 shrink-0 rounded-none border-0 border-r shadow-none"
        disabled={disabled || atMin}
        onClick={decrement}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className="h-8 w-14 shrink-0 rounded-none border-0 px-1 text-center text-sm tabular-nums shadow-none focus-visible:z-10 focus-visible:ring-0 sm:w-16"
        value={focused ? text : String(value)}
        onFocus={() => {
          setFocused(true)
          setText(String(value))
        }}
        onBlur={() => {
          setFocused(false)
          commitText(text)
          onBlur?.()
        }}
        onChange={(e) => {
          const s = e.target.value
          setText(s)
          if (s === "" || s === "-") return
          const n = Number.parseInt(s, 10)
          if (Number.isFinite(n)) {
            onValueChange(clampInt(n, effectiveMin, effectiveMax))
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-9 shrink-0 rounded-none border-0 border-l shadow-none"
        disabled={disabled || atMax}
        onClick={increment}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

export type FormQuantityStepperProps = Omit<FormFieldRowProps, "children"> & {
  id: string
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  stepperClassName?: string
  onBlur?: () => void
}

export function FormQuantityStepper({
  label,
  htmlFor,
  id,
  description,
  error,
  invalid,
  gap,
  className,
  labelProps,
  value,
  onValueChange,
  min,
  max,
  step,
  disabled,
  stepperClassName,
  onBlur,
}: FormQuantityStepperProps) {
  const err =
    typeof error === "string" && error.length > 0 ? error : undefined
  const isInvalid = invalid ?? Boolean(err)
  const forId = htmlFor ?? id

  // Custom layout: from sm+ we want the label and the input
  // (the stepper) on the same row.
  return (
    <Field className={cn(gap === "3" ? "gap-3" : "gap-2", className)} data-invalid={isInvalid}>
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={forId}
          className={cn("min-w-0 text-sm font-medium leading-snug", labelProps?.className)}
        >
          {label}
        </Label>
        <QuantityStepper
          id={id}
          value={value}
          onValueChange={onValueChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={isInvalid}
          className={stepperClassName}
          onBlur={onBlur}
        />
      </div>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {err ? <FieldError errors={[{ message: err }]} /> : null}
    </Field>
  )
}
