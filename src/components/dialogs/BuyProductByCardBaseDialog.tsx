import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState } from "react"
import { type Resolver, Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FormMoneyInput,
  FormQuantityStepper,
  FormSelectField,
  FormSwitchField,
  FormTextInput,
} from "@/components/form-input"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

    const userCollectionRows = Array.from({ length: values.quantity }).map(() => ({
      user_id: userId,
      graded: values.graded,
      derived: false,
      deleted: false,
      collection_item_id: item.id,
      buying_entries_id: buyEntryId,
    }))

    const userCollectionRes = await supabase
      .from("user_collection")
      .insert(userCollectionRows)
      .select("id")

    if (userCollectionRes.error || !userCollectionRes.data?.length) {
      await supabase.from("buy_entries").delete().eq("id", buyEntryId)
      setError("root", {
        type: "manual",
        message: userCollectionRes.error?.message ?? "Failed to save collection items.",
      })
      return
    }

    if (values.graded) {
      const gradeValue = Number(values.grade)
      const gradingRows = userCollectionRes.data.map((r) => ({
        user_collection_id: r.id,
        provider: values.provider,
        grade: gradeValue,
      }))

      const userCollectionGradingRes = await supabase
        .from("user_collection_grading")
        .insert(gradingRows)

      if (userCollectionGradingRes.error) {
        await supabase.from("buy_entries").delete().eq("id", buyEntryId)
        setError("root", {
          type: "manual",
          message: userCollectionGradingRes.error.message,
        })
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
      <DialogContent className="max-h-[min(90dvh,44rem)] gap-0 overflow-x-hidden p-0 sm:max-w-md">
        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={handleSubmit(onSubmit)}
        >
          <DialogBody className="px-0">
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
                    <FormSwitchField
                      id="buycb-graded"
                      label="Graded"
                      description="Whether the item is professionally graded."
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      invalid={!!errors.graded}
                    />
                  )}
                />

                {graded ? (
                  <div className="flex flex-col gap-3">
                    <Controller
                      name="provider"
                      control={control}
                      render={({ field: providerField }) => (
                        <FormSelectField
                          label="Provider"
                          htmlFor="buycb-provider"
                          error={errors.provider?.message}
                          invalid={!!errors.provider}
                        >
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
                        </FormSelectField>
                      )}
                    />

                    <FormTextInput
                      label="Grade"
                      id="buycb-grade"
                      error={errors.grade?.message}
                      invalid={!!errors.grade}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      placeholder="e.g. 10"
                      {...register("grade")}
                    />
                  </div>
                ) : null}

                <FormMoneyInput
                  label="Price (per 1)"
                  htmlFor="buycb-price"
                  error={errors.price?.message}
                  invalid={!!errors.price}
                  inputProps={{
                    id: "buycb-price",
                    type: "number",
                    inputMode: "decimal",
                    step: "any",
                    min: 0,
                    ...register("price"),
                  }}
                />

                <Controller
                  name="quantity"
                  control={control}
                  render={({ field }) => (
                    <FormQuantityStepper
                      label="Quantity"
                      id="buycb-quantity"
                      error={errors.quantity?.message}
                      invalid={!!errors.quantity}
                      min={1}
                      value={
                        typeof field.value === "number" && Number.isFinite(field.value)
                          ? field.value
                          : Number(field.value) || 1
                      }
                      onValueChange={(n) => field.onChange(n)}
                      onBlur={field.onBlur}
                    />
                  )}
                />

                <FormTextInput
                  label="Purchase Date"
                  id="buycb-purchase-date"
                  error={errors.purchaseDate?.message}
                  invalid={!!errors.purchaseDate}
                  type="date"
                  {...register("purchaseDate")}
                />
              </div>
            </FieldGroup>
          </div>
          </DialogBody>

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

