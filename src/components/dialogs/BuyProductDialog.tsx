import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState } from "react"
import { type Resolver, Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
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
  FormFieldRow,
  FormMoneyInput,
  FormQuantityStepper,
  FormSelectField,
  FormSwitchField,
  FormTextInput,
  FormToggleGroupField,
} from "@/components/form-input"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { supabase } from "@/lib/supabase"
import {
  GAME_TITLE_OPTIONS,
  GAME_TITLE_VALUES,
  type GameTitleValue,
} from "@/lib/gameTitles"
import { toast } from "sonner"

const PROVIDERS = ["PSA"] as const

export {
  GAME_TITLE_OPTIONS,
  GAME_TITLE_VALUES,
  GAME_TITLES,
  type GameTitleValue,
  gameTitleDisplayText,
} from "@/lib/gameTitles"

function todayISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

async function preprocessImageForUpload(input: File): Promise<File> {
  // Goal: reduce size while keeping quality (mobile photos are huge).
  // Strategy: resize longest edge to <= 2048px and re-encode as WebP (fallback JPEG).
  const MAX_DIM = 2048
  const QUALITY = 0.82

  if (!input.type.startsWith("image/")) return input

  const bitmap = await createImageBitmap(input)

  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const targetW = Math.max(1, Math.round(bitmap.width * scale))
  const targetH = Math.max(1, Math.round(bitmap.height * scale))

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(targetW, targetH)
      : Object.assign(document.createElement("canvas"), { width: targetW, height: targetH })

  const ctx = (canvas as HTMLCanvasElement).getContext
    ? (canvas as HTMLCanvasElement).getContext("2d")
    : (canvas as OffscreenCanvas).getContext("2d")

  if (!ctx) return input

  ;(ctx as CanvasRenderingContext2D).drawImage(bitmap as unknown as CanvasImageSource, 0, 0, targetW, targetH)
  bitmap.close?.()

  const toBlob = async (type: string, quality: number): Promise<Blob | null> => {
    if ("convertToBlob" in canvas) {
      try {
        return await (canvas as OffscreenCanvas).convertToBlob({ type, quality })
      } catch {
        return null
      }
    }
    return await new Promise<Blob | null>((resolve) => {
      ;(canvas as HTMLCanvasElement).toBlob((b) => resolve(b), type, quality)
    })
  }

  // Prefer WebP; fallback to JPEG if WebP isn't supported.
  const webpBlob = await toBlob("image/webp", QUALITY)
  const outBlob =
    webpBlob && webpBlob.size > 0 ? webpBlob : await toBlob("image/jpeg", QUALITY)

  if (!outBlob || outBlob.size === 0) return input

  const baseName = (input.name || "image").replace(/\.[^.]+$/, "")
  const outType = outBlob.type || "image/jpeg"
  const outExt = outType === "image/webp" ? "webp" : "jpg"
  return new File([outBlob], `${baseName}.${outExt}`, { type: outType })
}

const buyProductFormSchema = z
  .object({
    sourceImage: z.preprocess(
      (v) => (v === null ? undefined : v),
      z.custom<File>(
        (v) => typeof File !== "undefined" && v instanceof File,
        { message: "Source Image is required" }
      )
    ),
    gameTitle: z.enum(GAME_TITLE_VALUES).nullable().optional(),
    category: z.enum(["Card", "Product"]),
    cardNo: z.string(),
    name: z.string().min(1, "Name is required"),
    graded: z.boolean(),
    price: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v)),
      z.number()
    ),
    quantity: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v)),
      z
        .number()
        .int("Quantity must be a whole number")
        .min(1, "Quantity must be at least 1")
    ),
    purchaseDate: z.string().min(1, "Purchase date is required"),
    provider: z.string().min(1, "Provider is required"),
    grade: z.string(),
  })
  .refine(
    (data) => {
      if (data.category !== "Card") return true
      return data.cardNo.trim().length > 0
    },
    { path: ["cardNo"], message: "Card No. is required" }
  )
  .refine(
    (data) => {
      if (!data.graded) return true
      return data.provider.trim().length > 0
    },
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
  .refine(
    (data) => {
      return Number.isFinite(data.price) && !Number.isNaN(data.price)
    },
    { path: ["price"], message: "Price is required" }
  )
  .refine(
    (data) => {
      return Number.isFinite(data.quantity) && !Number.isNaN(data.quantity)
    },
    { path: ["quantity"], message: "Quantity is required" }
  )

export type BuyProductFormValues = {
  sourceImage: File | null
  gameTitle: GameTitleValue | null
  category: "Card" | "Product"
  cardNo: string
  name: string
  graded: boolean
  price: number
  quantity: number
  purchaseDate: string
  provider: string
  grade: string
}

const defaultFormValues: BuyProductFormValues = {
  sourceImage: null,
  gameTitle: null,
  category: "Card",
  cardNo: "",
  name: "",
  graded: false,
  price: 0,
  quantity: 1,
  purchaseDate: todayISODate(),
  provider: "PSA",
  grade: "",
}

type BuyProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitSuccess?: (values: BuyProductFormValues) => void
  /** Merged into defaults when `open` becomes true; clear from parent when dialog closes. */
  prefill?: Partial<BuyProductFormValues> | null
}

export function BuyProductDialog({
  open,
  onOpenChange,
  onSubmitSuccess,
  prefill = null,
}: BuyProductDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null)

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    setError,
  } = useForm<BuyProductFormValues>({
    resolver: zodResolver(buyProductFormSchema) as Resolver<BuyProductFormValues>,
    defaultValues: defaultFormValues,
  })

  const category = useWatch({ control, name: "category" })
  const graded = useWatch({ control, name: "graded" })

  useEffect(() => {
    if (!open) return

    setSourceImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })

    const base: BuyProductFormValues = {
      ...defaultFormValues,
      purchaseDate: todayISODate(),
    }
    const merged: BuyProductFormValues = {
      ...base,
      ...(prefill ?? {}),
      sourceImage: prefill?.sourceImage ?? null,
      purchaseDate: prefill?.purchaseDate?.trim()
        ? prefill.purchaseDate
        : base.purchaseDate,
    }
    reset(merged)

    if (prefill?.sourceImage) {
      setSourceImageUrl(URL.createObjectURL(prefill.sourceImage))
    }
  }, [open, prefill, reset])

  useEffect(() => {
    return () => {
      if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl)
    }
  }, [sourceImageUrl])

  async function handleSourceImagePaste(
    e: React.ClipboardEvent<HTMLDivElement>
  ) {
    const items = e.clipboardData?.items
    if (!items?.length) return

    const imgItem = Array.from(items).find((it) => it.type.startsWith("image/"))
    if (!imgItem) return

    const file = imgItem.getAsFile()
    if (!file) return

    e.preventDefault()
    setValue("sourceImage", file, { shouldDirty: true, shouldValidate: true })
    setSourceImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  async function onSubmit(values: BuyProductFormValues) {
    const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as
      | string
      | undefined

    if (!workerOrigin) {
      setError("root", {
        type: "manual",
        message: "Missing VITE_CF_WORKER_ORIGIN in .env",
      })
      return
    }

    const sessionRes = await supabase.auth.getSession()
    const session = sessionRes.data.session
    const userId = session?.user?.id
    const accessToken = session?.access_token

    if (!userId || !accessToken) {
      setError("root", { type: "manual", message: "Not signed in." })
      return
    }

    const originalFile = values.sourceImage
    if (!originalFile) {
      setError("sourceImage", {
        type: "manual",
        message: "Source Image is required",
      })
      return
    }

    let file: File
    try {
      file = await preprocessImageForUpload(originalFile)
    } catch {
      file = originalFile
    }

    const originalName = file.name || "image"
    const dot = originalName.lastIndexOf(".")
    const extRaw = dot >= 0 ? originalName.slice(dot + 1) : ""
    const ext = extRaw.trim().toLowerCase() || "jpg"

    const imageName =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now())

    const imagePath = `${userId}/${imageName}.${ext}`

    const base = workerOrigin.replace(/\/+$/, "")
    const uploadUrl = `${base}/?file=${encodeURIComponent(imagePath)}`

    let uploadRes: Response
    try {
      uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      })
    } catch (e) {
      setError("root", {
        type: "manual",
        message: `Image upload failed: could not reach Worker (${base}).`,
      })
      return
    }

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "")
      setError("root", {
        type: "manual",
        message: `Image upload failed (${uploadRes.status}). ${text}`.trim(),
      })
      return
    }

    const collectionRes = await supabase
      .from("collection_base")
      .insert({
        user_id: userId,
        game_title: values.gameTitle,
        product_category: values.category,
        card_no: values.category === "Card" ? values.cardNo : null,
        name: values.name,
        image_cloud_path: imagePath,
      })
      .select("id")
      .single()

    if (collectionRes.error || !collectionRes.data?.id) {
      setError("root", {
        type: "manual",
        message: collectionRes.error?.message ?? "Failed to save collection item.",
      })
      return
    }

    const collectionItemId = collectionRes.data.id

    const buyEntryRes = await supabase
      .from("buy_entries")
      .insert({
        user_id: userId,
        graded: values.graded,
        price_hkd: values.price,
        quantity: values.quantity,
        purchase_date: values.purchaseDate,
        collection_item_id: collectionItemId,
      })
      .select("id")
      .single()

    if (buyEntryRes.error || !buyEntryRes.data?.id) {
      await supabase.from("collection_base").delete().eq("id", collectionItemId)
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
        await supabase.from("collection_base").delete().eq("id", collectionItemId)
        setError("root", {
          type: "manual",
          message: gradingRes.error.message,
        })
        return
      }
    }

    const userCollectionRows = Array.from({ length: values.quantity }).map(() => ({
      user_id: userId,
      graded: values.graded,
      derived: false,
      deleted: false,
      collection_item_id: collectionItemId,
      buying_entries_id: buyEntryId,
    }))

    const userCollectionRes = await supabase
      .from("user_collection")
      .insert(userCollectionRows)
      .select("id")

    if (userCollectionRes.error || !userCollectionRes.data?.length) {
      await supabase.from("collection_base").delete().eq("id", collectionItemId)
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
        await supabase.from("collection_base").delete().eq("id", collectionItemId)
        setError("root", {
          type: "manual",
          message: userCollectionGradingRes.error.message,
        })
        return
      }
    }

    onSubmitSuccess?.(values)
    onOpenChange(false)
    toast.success("Saved successfully", { duration: 5000 })

    reset({
      ...defaultFormValues,
      purchaseDate: todayISODate(),
    })
    setSourceImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90dvh,40rem)] gap-0 overflow-x-hidden p-0 sm:max-w-md">
        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={handleSubmit(onSubmit)}
        >
          <DialogBody className="px-0">
          <div className="p-4 pb-2">
          <DialogHeader>
            <DialogTitle>Buy</DialogTitle>
            <DialogDescription>Enter details for the item you are purchasing.</DialogDescription>
          </DialogHeader>
        </div>
          <div className="px-4">
            <FieldGroup>
              {errors.root?.message ? (
                <FieldError errors={[{ message: errors.root.message }]} />
              ) : null}
              <FormFieldRow
                label="Source Image"
                htmlFor="buy-source-image"
                error={errors.sourceImage?.message}
                invalid={!!errors.sourceImage}
              >
                <div
                  className="flex flex-col gap-2"
                  onPaste={handleSourceImagePaste}
                >
                  <Input
                    ref={fileInputRef}
                    id="buy-source-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      setValue("sourceImage", file, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      setSourceImageUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev)
                        return file ? URL.createObjectURL(file) : null
                      })
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose / Take photo
                  </Button>

                  {sourceImageUrl ? (
                    <div className="overflow-hidden rounded-lg border">
                      <img
                        src={sourceImageUrl}
                        alt="Selected source"
                        className="max-h-64 w-full bg-muted/30 object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              </FormFieldRow>

              <Controller
                name="gameTitle"
                control={control}
                render={({ field }) => (
                  <FormSelectField
                    label="Game Title"
                    htmlFor="buy-game-title"
                    error={errors.gameTitle?.message}
                    invalid={!!errors.gameTitle}
                  >
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(v) =>
                        field.onChange((v as GameTitleValue) ?? null)
                      }
                    >
                      <SelectTrigger id="buy-game-title" className="w-full" size="default">
                        <SelectValue placeholder="Select game title" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {GAME_TITLE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormSelectField>
                )}
              />

              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <FormToggleGroupField
                    label="Product Category"
                    error={errors.category?.message}
                    invalid={!!errors.category}
                  >
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      className="w-full"
                      spacing={0}
                      value={field.value}
                      onValueChange={(v) => {
                        if (v) field.onChange(v as "Card" | "Product")
                      }}
                    >
                      <ToggleGroupItem
                        className="min-w-0 flex-1"
                        value="Card"
                        aria-label="Card"
                      >
                        Card
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        className="min-w-0 flex-1"
                        value="Product"
                        aria-label="Product"
                      >
                        Product
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormToggleGroupField>
                )}
              />

              {category === "Card" && (
                <>
                  <FormTextInput
                    label="Card No."
                    id="buy-card-no"
                    error={errors.cardNo?.message}
                    invalid={!!errors.cardNo}
                    autoComplete="off"
                    {...register("cardNo")}
                  />
                  <FormTextInput
                    label="Name"
                    id="buy-name-card"
                    error={errors.name?.message}
                    invalid={!!errors.name}
                    autoComplete="off"
                    {...register("name")}
                  />
                </>
              )}
              {category === "Product" && (
                <FormTextInput
                  label="Name"
                  id="buy-name-product"
                  error={errors.name?.message}
                  invalid={!!errors.name}
                  autoComplete="off"
                  {...register("name")}
                />
              )}

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
                      id="buy-graded"
                      label="Graded"
                      description="Whether the item is professionally graded."
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      invalid={!!errors.graded}
                    />
                  )}
                />

                {graded && (
                  <div className="flex flex-col gap-3">
                    <Controller
                      name="provider"
                      control={control}
                      render={({ field: providerField }) => (
                        <FormSelectField
                          label="Provider"
                          htmlFor="buy-provider"
                          error={errors.provider?.message}
                          invalid={!!errors.provider}
                        >
                          <Select
                            value={providerField.value}
                            onValueChange={providerField.onChange}
                          >
                            <SelectTrigger
                              id="buy-provider"
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
                      id="buy-grade"
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
                )}

                <FormMoneyInput
                  label="Price (per 1)"
                  htmlFor="buy-price"
                  error={errors.price?.message}
                  invalid={!!errors.price}
                  inputProps={{
                    id: "buy-price",
                    type: "number",
                    inputMode: "decimal",
                    step: "any",
                    min: 0,
                    "aria-invalid": !!errors.price,
                    ...register("price"),
                  }}
                />

                <Controller
                  name="quantity"
                  control={control}
                  render={({ field }) => (
                    <FormQuantityStepper
                      label="Quantity"
                      id="buy-quantity"
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
                  id="buy-purchase-date"
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
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
    </Dialog>
  )
}
