import * as React from "react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type FormFieldRowProps = {
  label: React.ReactNode
  htmlFor?: string
  description?: React.ReactNode
  error?: string | null | undefined | false
  /** Defaults to true when `error` is a non-empty string */
  invalid?: boolean
  gap?: "2" | "3"
  className?: string
  labelProps?: Omit<React.ComponentProps<typeof FieldLabel>, "children" | "htmlFor">
  children: React.ReactNode
}

export function FormFieldRow({
  label,
  htmlFor,
  description,
  error,
  invalid,
  gap = "2",
  className,
  labelProps,
  children,
}: FormFieldRowProps) {
  const err =
    typeof error === "string" && error.length > 0 ? error : undefined
  const isInvalid = invalid ?? Boolean(err)
  return (
    <Field
      className={cn(gap === "3" ? "gap-3" : "gap-2", className)}
      data-invalid={isInvalid}
    >
      <FieldLabel htmlFor={htmlFor} {...labelProps}>
        {label}
      </FieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {children}
      {err ? <FieldError errors={[{ message: err }]} /> : null}
    </Field>
  )
}

export type FormTextInputProps = Omit<
  FormFieldRowProps,
  "children" | "labelProps"
> & {
  id: string
  /** Merged with the input; use for `register()` and input attributes */
  inputClassName?: string
  labelProps?: FormFieldRowProps["labelProps"]
} & Omit<React.ComponentProps<typeof Input>, "id" | "className">

export function FormTextInput({
  label,
  htmlFor,
  id,
  description,
  error,
  invalid,
  gap,
  className,
  labelProps,
  inputClassName,
  ...inputProps
}: FormTextInputProps) {
  const forId = htmlFor ?? id
  const err =
    typeof error === "string" && error.length > 0 ? error : undefined
  const isInvalid = invalid ?? Boolean(err)
  return (
    <FormFieldRow
      label={label}
      htmlFor={forId}
      description={description}
      error={error}
      invalid={isInvalid}
      gap={gap}
      className={className}
      labelProps={labelProps}
    >
      <Input
        id={id}
        aria-invalid={isInvalid}
        className={cn("w-full", inputClassName)}
        {...inputProps}
      />
    </FormFieldRow>
  )
}
