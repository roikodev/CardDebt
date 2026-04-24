import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState } from "react"
import { type Resolver, Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

import type { CollectionBaseRow } from "@/components/dialogs/CardBaseDialog"

const PROVIDERS = ["PSA"] as const

function todayISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const formSchema = z
  .object({
    graded: z.boolean(),
    price: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v)),
      z.number()
    ),
    quantity: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v)),
      z.number().int().min(1, "Quantity must be at least 1")
    ),
    purchaseDate: z.string().min(1, "Purchase date is required"),
    provider: z.string().min(1, "Provider is required"),
    grade: z.string(),
  })
  .refine(
    (data) => (data.graded ? data.provider.trim().length > 0 : true),
    { path: ["provider"], message: "Provider is required" }
  )
  .refine(
    (data) => {
      if (!data.graded) return true
      const n = parseFloat(data.grade)
      return !Number.isNaN(n) && n > 0
    },
    { path: ["grade"], message: "Grade must be greater than 0" }
  )
  .refine((data) => Number.isFinite(data.price) && !Number.isNaN(data.price), {
    path: ["price"],
    message: "Price is required",
  })
  .refine((data) => Number.isFinite(data.quantity) && !Number.isNaN(data.quantity), {
    path: ["quantity"],
    message: "Quantity is required",
  })

export type BuyProductByCardBaseFormValues = {
  graded: boolean
  price: number
  quantity: number
  purchaseDate: string
  provider: string
  grade: string
}

const defaultValues: BuyProductByCardBaseFormValues = {
  graded: false,
  price: 0,
  quantity: 1,
  purchaseDate: todayISODate(),
  provider: "PSA",
  grade: "",
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CollectionBaseRow | null
}

export function BuyProductByCardBaseDialog({ open, onOpenChange, item }: Props) {
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<BuyProductByCardBaseFormValues>({
    resolver: zodResolver(formSchema) as Resolver<BuyProductByCardBaseFormValues>,
    defaultValues,
  })

  const graded = useWatch({ control, name: "graded" })

  useEffect(() => {
    if (!open) return
    reset({ ...defaultValues, purchaseDate: todayISODate() })
  }, [open, reset])

  useEffect(() => {
    if (!open || !item?.image_cloud_path || !workerOrigin) {
      setSignedImageUrl(null)
      return
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    ;(async () => {
      const sessionRes = await supabase.auth.getSession()
      const accessToken = sessionRes.data.session?.access_token
      if (!accessToken) return

      const base = workerOrigin.replace(/\/+$/, "")
      const filePath = item.image_cloud_path
      if (!filePath) return
      const url = `${base}/signed?file=${encodeURIComponent(filePath)}&ttl=300`
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal,
      })
      if (!res.ok) return
      const data = (await res.json()) as { url?: string }
      if (data.url) setSignedImageUrl(data.url)
    })()

    return () => {
      abortRef.current?.abort()
    }
  }, [item?.image_cloud_path, open, workerOrigin])

  async function onSubmit(values: BuyProductByCardBaseFormValues) {
    if (!item?.id) {
      setError("root", { type: "manual", message: "No Card Base item selected." })
      return
    }

    const sessionRes = await supabase.auth.getSession()
    const session = sessionRes.data.session
    const userId = session?.user?.id
    if (!userId) {
      setError("root", { type: "manual", message: "Not signed in." })
      return
    }

    const buyEntryRes = await supabase
      .from("buy_entries")
      .insert({
        user_id: userId,
        graded: values.graded,
        price_hkd: values.price,
        quantity: values.quantity,
        purchase_date: values.purchaseDate,
        collection_item_id: item.id,
      })
      .select("id")
      .single()

    if (buyEntryRes.error || !buyEntryRes.data?.id) {
      setError("root", {
        type: "manual",
        message: buyEntryRes.error?.message ?? "Failed to save purchase.",
      })
      return
    }

    const buyEntryId = buyEntryRes.data.id

    if (values.graded) {
      const gradeValue = Number(values.grade)
      const gradingRes = await supabase.from("buy_entry_grading").insert({
        buy_entry_id: buyEntryId,
        provider: values.provider,
        grade: gradeValue,
      })

      if (gradingRes.error) {
        setError("root", { type: "manual", message: gradingRes.error.message })
        return
      }
    }

    onOpenChange(false)
    toast.success("Saved successfully", { duration: 5000 })
  }

  const title = item?.name ?? "Selected item"
  const meta = [item?.game_title, item?.card_no].filter(Boolean).join(" · ")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,44rem)] gap-0 overflow-y-auto overflow-x-hidden p-0 sm:max-w-md">
        <div className="p-4 pb-2">
          <DialogHeader>
            <DialogTitle>Buy</DialogTitle>
            <DialogDescription>Complete purchase details for this item.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-4 pb-3">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="aspect-[4/3] w-full bg-muted/30">
              {signedImageUrl ? (
                <img
                  src={signedImageUrl}
                  alt={title}
                  className="h-full w-full object-cover object-left-top"
                />
              ) : (
                <div className="h-full w-full animate-pulse bg-muted/50" />
              )}
            </div>
            <div className="space-y-1 p-3 text-left">
              <p className="text-sm font-medium leading-snug">{title}</p>
              <p className="text-xs text-muted-foreground">{meta || "—"}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-4">
            <FieldGroup>
              {errors.root?.message ? (
                <FieldError errors={[{ message: errors.root.message }]} />
              ) : null}

              <div
                className="mb-3 flex flex-col gap-2 border-t pt-3"
                role="group"
                aria-label="Common details"
              >
                <p className="text-sm font-medium">Details</p>

                <Controller
                  name="graded"
                  control={control}
                  render={({ field }) => (
                    <Field className="gap-2" data-invalid={!!errors.graded}>
                      <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center @md/field-group:justify-between">
                        <div className="flex flex-col gap-0.5">
                          <FieldLabel htmlFor="buycb-graded">Graded</FieldLabel>
                          <FieldDescription>
                            Whether the item is professionally graded.
                          </FieldDescription>
                        </div>
                        <Switch
                          id="buycb-graded"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-invalid={!!errors.graded}
                        />
                      </div>
                    </Field>
                  )}
                />

                {graded ? (
                  <div className="flex flex-col gap-3">
                    <Controller
                      name="provider"
                      control={control}
                      render={({ field: providerField }) => (
                        <Field className="gap-2" data-invalid={!!errors.provider}>
                          <FieldLabel htmlFor="buycb-provider">Provider</FieldLabel>
                          <Select
                            value={providerField.value}
                            onValueChange={providerField.onChange}
                          >
                            <SelectTrigger
                              id="buycb-provider"
                              className="w-full"
                              size="default"
                              aria-invalid={!!errors.provider}
                            >
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {PROVIDERS.map((p) => (
                                  <SelectItem key={p} value={p}>
                                    {p}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          {errors.provider?.message ? (
                            <FieldError errors={[{ message: errors.provider.message }]} />
                          ) : null}
                        </Field>
                      )}
                    />

                    <Field className="gap-2" data-invalid={!!errors.grade}>
                      <FieldLabel htmlFor="buycb-grade">Grade</FieldLabel>
                      <Input
                        id="buycb-grade"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min={0}
                        placeholder="e.g. 10"
                        aria-invalid={!!errors.grade}
                        className="w-full"
                        {...register("grade")}
                      />
                      {errors.grade?.message ? (
                        <FieldError errors={[{ message: errors.grade.message }]} />
                      ) : null}
                    </Field>
                  </div>
                ) : null}

                <Field className="gap-2" data-invalid={!!errors.price}>
                  <FieldLabel htmlFor="buycb-price">Price (per 1)</FieldLabel>
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center rounded-l-lg border border-input bg-muted/50 px-2 text-sm text-muted-foreground"
                    >
                      HKD$
                    </span>
                    <Input
                      id="buycb-price"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      aria-invalid={!!errors.price}
                      className="w-full pl-16"
                      {...register("price")}
                    />
                  </div>
                  {errors.price?.message ? (
                    <FieldError errors={[{ message: errors.price.message }]} />
                  ) : null}
                </Field>

                <Field className="gap-2" data-invalid={!!errors.quantity}>
                  <FieldLabel htmlFor="buycb-quantity">Quantity</FieldLabel>
                  <Input
                    id="buycb-quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    aria-invalid={!!errors.quantity}
                    className="w-full"
                    {...register("quantity")}
                  />
                  {errors.quantity?.message ? (
                    <FieldError errors={[{ message: errors.quantity.message }]} />
                  ) : null}
                </Field>

                <Field className="gap-2" data-invalid={!!errors.purchaseDate}>
                  <FieldLabel htmlFor="buycb-purchase-date">Purchase Date</FieldLabel>
                  <Input
                    id="buycb-purchase-date"
                    type="date"
                    aria-invalid={!!errors.purchaseDate}
                    className="w-full"
                    {...register("purchaseDate")}
                  />
                  {errors.purchaseDate?.message ? (
                    <FieldError errors={[{ message: errors.purchaseDate.message }]} />
                  ) : null}
                </Field>
              </div>
            </FieldGroup>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

