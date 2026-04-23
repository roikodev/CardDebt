import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState } from "react"
import { type Resolver, Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { supabase } from "@/lib/supabase"

const PROVIDERS = ["PSA"] as const
const GAME_TITLES = ["Pokemon JP", "YGO OCG", "BS"] as const

function todayISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
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
    gameTitle: z.enum(GAME_TITLES).nullable().optional(),
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
  gameTitle: (typeof GAME_TITLES)[number] | null
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
}

export function BuyProductDialog({
  open,
  onOpenChange,
  onSubmitSuccess,
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
    if (open) {
      reset({
        ...defaultFormValues,
        purchaseDate: todayISODate(),
      })
    }
  }, [open, reset])

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
    const sessionRes = await supabase.auth.getSession()
    const session = sessionRes.data.session
    const userId = session?.user?.id
    const accessToken = session?.access_token

    if (!userId || !accessToken) {
      setError("root", { type: "manual", message: "Not signed in." })
      return
    }

    const file = values.sourceImage
    if (!file) {
      setError("sourceImage", {
        type: "manual",
        message: "Source Image is required",
      })
      return
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

    const uploadRes = await supabase.storage
      .from("card-debt-purchases")
      .upload(imagePath, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      })

    if (uploadRes.error) {
      setError("root", { type: "manual", message: uploadRes.error.message })
      return
    }

    const insertRes = await supabase
      .from("buy_entries")
      .insert({
        user_id: userId,
        game_title: values.gameTitle,
        product_category: values.category,
        card_no: values.category === "Card" ? values.cardNo : null,
        name: values.name,
        graded: values.graded,
        price_hkd: values.price,
        quantity: values.quantity,
        image_cloud_path: imagePath,
        purchase_date: values.purchaseDate,
      })
      .select("id")
      .single()

    if (insertRes.error || !insertRes.data?.id) {
      setError("root", {
        type: "manual",
        message: insertRes.error?.message ?? "Failed to save purchase.",
      })
      return
    }

    const buyEntryId = insertRes.data.id

    if (values.graded) {
      const gradeValue = Number(values.grade)
      const gradingRes = await supabase.from("buy_entry_grading").insert({
        buy_entry_id: buyEntryId,
        provider: values.provider,
        grade: gradeValue,
      })

      if (gradingRes.error) {
        setError("root", {
          type: "manual",
          message: gradingRes.error.message,
        })
        return
      }
    }

    onSubmitSuccess?.(values)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,40rem)] gap-0 overflow-y-auto overflow-x-hidden p-0 sm:max-w-md">
        <div className="p-4 pb-2">
          <DialogHeader>
            <DialogTitle>Buy</DialogTitle>
            <DialogDescription>Enter details for the item you are purchasing.</DialogDescription>
          </DialogHeader>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="px-4">
            <FieldGroup>
              {errors.root?.message ? (
                <FieldError errors={[{ message: errors.root.message }]} />
              ) : null}
              <Field className="gap-2">
                <FieldLabel htmlFor="buy-source-image">
                  Source Image
                </FieldLabel>
                <div
                  className="flex flex-col gap-2"
                  onPaste={handleSourceImagePaste}
                >
                  <Input
                    ref={fileInputRef}
                    id="buy-source-image"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="w-full"
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
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose / Take photo
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      You can also paste an image here.
                    </p>
                  </div>

                  {sourceImageUrl ? (
                    <div className="overflow-hidden rounded-lg border">
                      <img
                        src={sourceImageUrl}
                        alt="Selected source"
                        className="max-h-64 w-full bg-muted/30 object-contain"
                      />
                    </div>
                  ) : null}

                  {errors.sourceImage?.message ? (
                    <FieldError errors={[{ message: errors.sourceImage.message }]} />
                  ) : null}
                </div>
              </Field>

              <Controller
                name="gameTitle"
                control={control}
                render={({ field }) => (
                  <Field className="gap-2" data-invalid={!!errors.gameTitle}>
                    <FieldLabel htmlFor="buy-game-title">Game Title</FieldLabel>
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(v) =>
                        field.onChange((v as BuyProductFormValues["gameTitle"]) ?? null)
                      }
                    >
                      <SelectTrigger id="buy-game-title" className="w-full" size="default">
                        <SelectValue placeholder="Select game title" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {GAME_TITLES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {errors.gameTitle?.message ? (
                      <FieldError errors={[{ message: errors.gameTitle.message }]} />
                    ) : null}
                  </Field>
                )}
              />

              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Field
                    className="gap-3"
                    data-invalid={!!errors.category}
                  >
                    <FieldLabel>
                      Product Category
                    </FieldLabel>
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
                    {errors.category?.message ? (
                      <FieldError errors={[{ message: errors.category.message }]} />
                    ) : null}
                  </Field>
                )}
              />

              {category === "Card" && (
                <>
                  <Field
                    className="gap-2"
                    data-invalid={!!errors.cardNo}
                  >
                    <FieldLabel htmlFor="buy-card-no">
                      Card No.
                    </FieldLabel>
                    <Input
                      id="buy-card-no"
                      autoComplete="off"
                      aria-invalid={!!errors.cardNo}
                      className="w-full"
                      {...register("cardNo")}
                    />
                    {errors.cardNo ? (
                      <FieldError errors={[{ message: errors.cardNo.message }]} />
                    ) : null}
                  </Field>
                  <Field
                    className="gap-2"
                    data-invalid={!!errors.name}
                  >
                    <FieldLabel htmlFor="buy-name-card">
                      Name
                    </FieldLabel>
                    <Input
                      id="buy-name-card"
                      autoComplete="off"
                      aria-invalid={!!errors.name}
                      className="w-full"
                      {...register("name")}
                    />
                    {errors.name ? (
                      <FieldError errors={[{ message: errors.name.message }]} />
                    ) : null}
                  </Field>
                </>
              )}
              {category === "Product" && (
                <Field
                  className="gap-2"
                  data-invalid={!!errors.name}
                >
                  <FieldLabel htmlFor="buy-name-product">
                    Name
                  </FieldLabel>
                  <Input
                    id="buy-name-product"
                    autoComplete="off"
                    aria-invalid={!!errors.name}
                    className="w-full"
                    {...register("name")}
                  />
                  {errors.name ? (
                    <FieldError errors={[{ message: errors.name.message }]} />
                  ) : null}
                </Field>
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
                    <Field
                      className="gap-2"
                      data-invalid={!!errors.graded}
                    >
                      <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center @md/field-group:justify-between">
                        <div className="flex flex-col gap-0.5">
                          <FieldLabel htmlFor="buy-graded">
                            Graded
                          </FieldLabel>
                          <FieldDescription>Whether the item is professionally graded.</FieldDescription>
                        </div>
                        <Switch
                          id="buy-graded"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-invalid={!!errors.graded}
                        />
                      </div>
                    </Field>
                  )}
                />

                {graded && (
                  <div className="flex flex-col gap-3">
                    <Controller
                      name="provider"
                      control={control}
                      render={({ field: providerField }) => (
                        <Field
                          className="gap-2"
                          data-invalid={!!errors.provider}
                        >
                          <FieldLabel htmlFor="buy-provider">
                            Provider
                          </FieldLabel>
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
                          {errors.provider ? (
                            <FieldError
                              errors={[{ message: errors.provider.message }]}
                            />
                          ) : null}
                        </Field>
                      )}
                    />
                    <Field
                      className="gap-2"
                      data-invalid={!!errors.grade}
                    >
                      <FieldLabel htmlFor="buy-grade">
                        Grade
                      </FieldLabel>
                      <Input
                        id="buy-grade"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min={0}
                        placeholder="e.g. 10"
                        aria-invalid={!!errors.grade}
                        className="w-full"
                        {...register("grade")}
                      />
                      {errors.grade ? (
                        <FieldError
                          errors={[{ message: errors.grade.message }]}
                        />
                      ) : null}
                    </Field>
                  </div>
                )}

                <Field
                  className="gap-2"
                  data-invalid={!!errors.price}
                >
                  <FieldLabel htmlFor="buy-price">
                    Price (per 1)
                  </FieldLabel>
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center rounded-l-lg border border-input bg-muted/50 px-2 text-sm text-muted-foreground"
                    >
                      HKD$
                    </span>
                    <Input
                      id="buy-price"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      aria-invalid={!!errors.price}
                      className="w-full pl-16"
                      {...register("price")}
                    />
                  </div>
                  {errors.price ? (
                    <FieldError errors={[{ message: errors.price.message }]} />
                  ) : null}
                </Field>

                <Field
                  className="gap-2"
                  data-invalid={!!errors.quantity}
                >
                  <FieldLabel htmlFor="buy-quantity">
                    Quantity
                  </FieldLabel>
                  <Input
                    id="buy-quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    aria-invalid={!!errors.quantity}
                    className="w-full"
                    {...register("quantity")}
                  />
                  {errors.quantity ? (
                    <FieldError errors={[{ message: errors.quantity.message }]} />
                  ) : null}
                </Field>

                <Field
                  className="gap-2"
                  data-invalid={!!errors.purchaseDate}
                >
                  <FieldLabel htmlFor="buy-purchase-date">
                    Purchase Date
                  </FieldLabel>
                  <Input
                    id="buy-purchase-date"
                    type="date"
                    aria-invalid={!!errors.purchaseDate}
                    className="w-full"
                    {...register("purchaseDate")}
                  />
                  {errors.purchaseDate ? (
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
