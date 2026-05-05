import * as React from "react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import type { FormFieldRowProps } from "@/components/form-input/form-field-row"
import { FormFieldRow } from "@/components/form-input/form-field-row"

export type FormMoneyInputProps = Omit<FormFieldRowProps, "children"> & {
  inputProps: React.ComponentProps<typeof Input>
  /** Prefix shown inside the input area (default HKD$) */
  currencyPrefix?: React.ReactNode
}

export function FormMoneyInput({
  label,
  htmlFor,
  description,
  error,
  invalid,
  gap,
  className,
  labelProps,
  currencyPrefix = "HKD$",
  inputProps,
}: FormMoneyInputProps) {
  const err =
    typeof error === "string" && error.length > 0 ? error : undefined
  const isInvalid = invalid ?? Boolean(err)
  const id = inputProps.id ?? htmlFor
  const { className: inputCn, ...restInput } = inputProps
  return (
    <FormFieldRow
      label={label}
      htmlFor={id}
      description={description}
      error={error}
      invalid={isInvalid}
      gap={gap}
      className={className}
      labelProps={labelProps}
    >
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center rounded-l-lg border border-input bg-muted/50 px-2 text-sm text-muted-foreground"
        >
          {currencyPrefix}
        </span>
        <Input
          {...restInput}
          id={id}
          aria-invalid={isInvalid}
          className={cn("w-full pl-16", inputCn)}
        />
      </div>
    </FormFieldRow>
  )
}

export type FormSelectFieldProps = Omit<FormFieldRowProps, "children"> & {
  children: React.ReactNode
}

/** Wraps a full `Select` tree (trigger + content). */
export function FormSelectField({
  children,
  ...rowProps
}: FormSelectFieldProps) {
  return <FormFieldRow {...rowProps}>{children}</FormFieldRow>
}

export type FormToggleGroupFieldProps = {
  label: React.ReactNode
  error?: string | null | undefined | false
  invalid?: boolean
  gap?: "2" | "3"
  className?: string
  children: React.ReactNode
}

export function FormToggleGroupField({
  label,
  error,
  invalid,
  gap = "3",
  className,
  children,
}: FormToggleGroupFieldProps) {
  const err =
    typeof error === "string" && error.length > 0 ? error : undefined
  const isInvalid = invalid ?? Boolean(err)
  return (
    <Field
      className={cn(gap === "3" ? "gap-3" : "gap-2", className)}
      data-invalid={isInvalid}
    >
      <FieldLabel>{label}</FieldLabel>
      {children}
      {err ? <FieldError errors={[{ message: err }]} /> : null}
    </Field>
  )
}

export type FormSwitchFieldProps = {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  invalid?: boolean
  className?: string
}

export function FormSwitchField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  invalid,
  className,
}: FormSwitchFieldProps) {
  return (
    <Field className={cn("gap-2", className)} data-invalid={invalid}>
      <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center @md/field-group:justify-between">
        <div className="flex flex-col gap-0.5">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
        </div>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-invalid={invalid}
        />
      </div>
    </Field>
  )
}
