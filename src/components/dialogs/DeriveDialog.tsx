import { useEffect, useMemo, useRef, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CardBaseDialog, type CollectionBaseRow } from "@/components/dialogs/CardBaseDialog"
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
import { Switch } from "@/components/ui/switch"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { supabase } from "@/lib/supabase"
import {
  DerivedItemCostDialog,
  type DerivedItemCostTarget,
} from "./DerivedItemCostDialog"
import { DeriveSummaryDialog } from "@/components/dialogs/DeriveSummaryDialog"
import { LayoutGrid, Plus, PlusSquare, Trash2 } from "lucide-react"

type DeriveMode = "create_new" | "choose_from_base"

const GAME_TITLES = ["Pokemon JP", "YGO OCG", "BS"] as const
const PROVIDERS = ["PSA"] as const

type DerivedItemDraft = {
  id: string
  mode: DeriveMode | null
  selectedBase: CollectionBaseRow | null
  chooseFromBase: {
    graded: boolean
    provider: (typeof PROVIDERS)[number]
    grade: string
  }
  createNew: {
    sourceImage: File | null
    sourceImageUrl: string | null
    gameTitle: (typeof GAME_TITLES)[number] | null
    category: "Card" | "Product"
    cardNo: string
    name: string
    graded: boolean
    provider: (typeof PROVIDERS)[number]
    grade: string
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceCollectionItemId: string
  sourceGraded: boolean
  sourceQuantity: number
  onSubmitted?: () => void
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random())
}

export function DeriveDialog({
  open,
  onOpenChange,
  sourceCollectionItemId: _sourceCollectionItemId,
  sourceGraded: _sourceGraded,
  sourceQuantity,
  onSubmitted,
}: Props) {
  const [items, setItems] = useState<DerivedItemDraft[]>(() => [
    {
      id: uid(),
      mode: null,
      selectedBase: null,
      chooseFromBase: {
        graded: false,
        provider: "PSA",
        grade: "",
      },
      createNew: {
        sourceImage: null,
        sourceImageUrl: null,
        gameTitle: null,
        category: "Card",
        cardNo: "",
        name: "",
        graded: false,
        provider: "PSA",
        grade: "",
      },
    },
  ])
  const [sets, setSets] = useState(1)
  const [pickingForId, setPickingForId] = useState<string | null>(null)
  const [pickedBaseImageUrls, setPickedBaseImageUrls] = useState<Record<string, string>>({})
  const abortRef = useRef<AbortController | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [costOpen, setCostOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [perItemCosts, setPerItemCosts] = useState<Record<string, import("./DerivedItemCostDialog").CostEntry[]>>({})

  const costTargets = useMemo<DerivedItemCostTarget[]>(() => {
    return items.map((it) => {
      const title =
        it.mode === "choose_from_base"
          ? it.selectedBase?.name ?? "Choose from Card Base"
          : it.mode === "create_new"
            ? it.createNew.name?.trim() || "Create New"
            : "Unselected"

      const subtitle =
        it.mode === "choose_from_base"
          ? [it.selectedBase?.game_title, it.selectedBase?.card_no].filter(Boolean).join(" · ") || "—"
          : it.mode === "create_new"
            ? [it.createNew.gameTitle, it.createNew.category === "Card" ? it.createNew.cardNo : null]
                .filter(Boolean)
                .join(" · ") || "—"
            : "—"

      const imageSrc =
        it.mode === "choose_from_base"
          ? pickedBaseImageUrls[it.id] ?? null
          : it.mode === "create_new"
            ? it.createNew.sourceImageUrl ?? null
            : null

      return { id: it.id, title, subtitle, imageSrc }
    })
  }, [items, pickedBaseImageUrls])

  const pickingItem = useMemo(
    () => items.find((i) => i.id === pickingForId) ?? null,
    [items, pickingForId]
  )

  const canConfirm = useMemo(() => {
    return (
      items.length > 0 &&
      sets >= 1 &&
      sets <= Math.max(0, sourceQuantity || 0) &&
      items.every((i) =>
        i.mode === null
          ? false
          : i.mode === "create_new"
            ? Boolean(i.createNew.sourceImage && i.createNew.name.trim())
            : !!i.selectedBase
      )
    )
  }, [items, sets, sourceQuantity])

  useEffect(() => {
    if (!open) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    ;(async () => {
      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token
      if (!token) return

      const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined
      if (!workerOrigin?.trim()) return
      const baseUrl = workerOrigin.replace(/\/+$/, "")

      const baseItems = items.filter(
        (i) => i.mode === "choose_from_base" && i.selectedBase?.image_cloud_path
      )

      await Promise.all(
        baseItems.map(async (it) => {
          const filePath = it.selectedBase?.image_cloud_path
          if (!filePath) return
          if (pickedBaseImageUrls[it.id]) return
          try {
            const res = await fetch(
              `${baseUrl}/signed?file=${encodeURIComponent(filePath)}&ttl=300`,
              { headers: { Authorization: `Bearer ${token}` }, signal }
            )
            if (!res.ok) return
            const data = (await res.json()) as { url?: string }
            if (!data.url) return
            setPickedBaseImageUrls((prev) => ({ ...prev, [it.id]: data.url! }))
          } catch {
            // ignore
          }
        })
      )
    })()

    return () => abortRef.current?.abort()
  }, [items, open, pickedBaseImageUrls])

  useEffect(() => {
    if (open) return
    abortRef.current?.abort()
    setPickedBaseImageUrls({})
    setSubmitAttempted(false)
    setCostOpen(false)
    setSummaryOpen(false)
    setPerItemCosts({})
    setSets(1)
    setItems((prev) =>
      prev.map((it) => {
        if (it.createNew.sourceImageUrl) URL.revokeObjectURL(it.createNew.sourceImageUrl)
        return {
          ...it,
          createNew: { ...it.createNew, sourceImage: null, sourceImageUrl: null },
        }
      })
    )
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90dvh,46rem)] overflow-y-auto sm:max-w-lg p-0">
          <div className="p-5 sm:p-6">
            <DialogHeader className="px-0">
              <DialogTitle>Derive</DialogTitle>
              <DialogDescription>
                Choose how this item is derived. You can create multiple derived outputs.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              {items.map((it, idx) => (
                <div key={it.id} className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Derived item {idx + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                    disabled={items.length === 1}
                    aria-label="Remove derived item"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={it.mode === "create_new" ? "default" : "outline"}
                    className="h-24 flex-col items-center justify-center gap-2 text-center"
                    onClick={() =>
                      setItems((prev) =>
                        prev.map((x) =>
                          x.id === it.id
                            ? {
                                ...x,
                                mode: "create_new",
                              }
                            : x
                        )
                      )
                    }
                  >
                    <PlusSquare aria-hidden="true" className="size-9" />
                    <span className="whitespace-normal break-words text-sm font-medium leading-tight">
                      Create New
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant={it.mode === "choose_from_base" ? "default" : "outline"}
                    className="h-24 flex-col items-center justify-center gap-2 text-center"
                    onClick={() =>
                      setItems((prev) =>
                        prev.map((x) =>
                          x.id === it.id
                            ? {
                                ...x,
                                mode: "choose_from_base",
                              }
                            : x
                        )
                      )
                    }
                  >
                    <LayoutGrid aria-hidden="true" className="size-9" />
                    <span className="whitespace-normal break-words text-sm font-medium leading-tight">
                      Choose from Card Base
                    </span>
                  </Button>
                </div>

                {it.mode === "choose_from_base" ? (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-lg border bg-muted/30">
                          {pickedBaseImageUrls[it.id] ? (
                            <img
                              src={pickedBaseImageUrls[it.id]}
                              alt={it.selectedBase?.name ?? "Selected item"}
                              className="h-full w-full object-cover object-left-top"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full animate-pulse bg-muted/50" />
                          )}
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="truncate text-sm font-medium">
                            {it.selectedBase?.name ?? "No item selected"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[it.selectedBase?.game_title, it.selectedBase?.card_no]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" onClick={() => setPickingForId(it.id)}>
                        Choose
                      </Button>
                    </div>

                    <div
                      className="mb-0 mt-3 flex flex-col gap-2 border-t pt-3"
                      role="group"
                      aria-label="Common details"
                    >
                      <p className="text-sm font-medium">Details</p>

                      <Field className="gap-2">
                        <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center @md/field-group:justify-between">
                          <div className="flex flex-col gap-0.5">
                            <FieldLabel htmlFor={`derive-base-graded-${it.id}`}>Graded</FieldLabel>
                            <FieldDescription>Whether the item is professionally graded.</FieldDescription>
                          </div>
                          <Switch
                            id={`derive-base-graded-${it.id}`}
                            checked={it.chooseFromBase.graded}
                            onCheckedChange={(checked) =>
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.id === it.id
                                    ? {
                                        ...x,
                                        chooseFromBase: { ...x.chooseFromBase, graded: checked },
                                      }
                                    : x
                                )
                              )
                            }
                          />
                        </div>
                      </Field>

                      {it.chooseFromBase.graded ? (
                        <div className="flex flex-col gap-3">
                          <Field className="gap-2">
                            <FieldLabel htmlFor={`derive-base-provider-${it.id}`}>Provider</FieldLabel>
                            <Select
                              value={it.chooseFromBase.provider}
                              onValueChange={(v) => {
                                if (!PROVIDERS.includes(v as any)) return
                                setItems((prev) =>
                                  prev.map((x) =>
                                    x.id === it.id
                                      ? {
                                          ...x,
                                          chooseFromBase: {
                                            ...x.chooseFromBase,
                                            provider: v as any,
                                          },
                                        }
                                      : x
                                  )
                                )
                              }}
                            >
                              <SelectTrigger
                                id={`derive-base-provider-${it.id}`}
                                className="w-full"
                                size="default"
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
                          </Field>

                          <Field className="gap-2">
                            <FieldLabel htmlFor={`derive-base-grade-${it.id}`}>Grade</FieldLabel>
                            <Input
                              id={`derive-base-grade-${it.id}`}
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min={0}
                              placeholder="e.g. 10"
                              className="w-full"
                              value={it.chooseFromBase.grade}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((x) =>
                                    x.id === it.id
                                      ? {
                                          ...x,
                                          chooseFromBase: {
                                            ...x.chooseFromBase,
                                            grade: e.target.value,
                                          },
                                        }
                                      : x
                                  )
                                )
                              }
                            />
                          </Field>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : it.mode === "create_new" ? (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                    <FieldGroup>
                      <Field className="gap-2">
                        <FieldLabel htmlFor={`derive-source-image-${it.id}`}>
                          Source Image
                        </FieldLabel>
                        <div
                          className="flex flex-col gap-2"
                          onPaste={(e) => {
                            const item = Array.from(e.clipboardData.items).find((i) =>
                              i.type.startsWith("image/")
                            )
                            const file = item?.getAsFile() ?? null
                            if (!file) return
                            e.preventDefault()
                            setItems((prev) =>
                              prev.map((x) => {
                                if (x.id !== it.id) return x
                                if (x.createNew.sourceImageUrl)
                                  URL.revokeObjectURL(x.createNew.sourceImageUrl)
                                return {
                                  ...x,
                                  createNew: {
                                    ...x.createNew,
                                    sourceImage: file,
                                    sourceImageUrl: URL.createObjectURL(file),
                                  },
                                }
                              })
                            )
                          }}
                        >
                          <Input
                            id={`derive-source-image-${it.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null
                              setItems((prev) =>
                                prev.map((x) => {
                                  if (x.id !== it.id) return x
                                  if (x.createNew.sourceImageUrl)
                                    URL.revokeObjectURL(x.createNew.sourceImageUrl)
                                  return {
                                    ...x,
                                    createNew: {
                                      ...x.createNew,
                                      sourceImage: file,
                                      sourceImageUrl: file ? URL.createObjectURL(file) : null,
                                    },
                                  }
                                })
                              )
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                document
                                  .getElementById(`derive-source-image-${it.id}`)
                                  ?.click()
                              }
                            >
                              Choose / Take photo
                            </Button>
                            <p className="text-sm text-muted-foreground">
                              Choose from album or open camera. You can also paste an image here.
                            </p>
                          </div>

                          {it.createNew.sourceImageUrl ? (
                            <div className="overflow-hidden rounded-lg border">
                              <img
                                src={it.createNew.sourceImageUrl}
                                alt="Selected source"
                                className="max-h-64 w-full bg-muted/30 object-contain"
                              />
                            </div>
                          ) : null}

                          {submitAttempted && !it.createNew.sourceImage && !it.createNew.sourceImageUrl ? (
                            <FieldError errors={[{ message: "Source Image is required" }]} />
                          ) : null}
                        </div>
                      </Field>

                      <Field className="gap-2">
                        <FieldLabel htmlFor={`derive-game-title-${it.id}`}>Game Title</FieldLabel>
                        <Select
                          value={it.createNew.gameTitle ?? undefined}
                          onValueChange={(v) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id
                                  ? {
                                      ...x,
                                      createNew: {
                                        ...x.createNew,
                                        gameTitle: ((v as any) ?? null) as any,
                                      },
                                    }
                                  : x
                              )
                            )
                          }
                        >
                          <SelectTrigger id={`derive-game-title-${it.id}`} className="w-full" size="default">
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
                      </Field>

                      <Field className="gap-3">
                        <FieldLabel>Product Category</FieldLabel>
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          className="w-full"
                          spacing={0}
                          value={it.createNew.category}
                          onValueChange={(v) => {
                            if (!v) return
                            if (v !== "Card" && v !== "Product") return
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id
                                  ? { ...x, createNew: { ...x.createNew, category: v } }
                                  : x
                              )
                            )
                          }}
                        >
                          <ToggleGroupItem className="min-w-0 flex-1" value="Card" aria-label="Card">
                            Card
                          </ToggleGroupItem>
                          <ToggleGroupItem className="min-w-0 flex-1" value="Product" aria-label="Product">
                            Product
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </Field>

                      {it.createNew.category === "Card" ? (
                        <Field className="gap-2">
                          <FieldLabel htmlFor={`derive-card-no-${it.id}`}>Card No.</FieldLabel>
                          <Input
                            id={`derive-card-no-${it.id}`}
                            autoComplete="off"
                            className="w-full"
                            value={it.createNew.cardNo}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.id === it.id
                                    ? {
                                        ...x,
                                        createNew: { ...x.createNew, cardNo: e.target.value },
                                      }
                                    : x
                                )
                              )
                            }
                          />
                        </Field>
                      ) : null}

                      <Field className="gap-2" data-invalid={submitAttempted && !it.createNew.name.trim()}>
                        <FieldLabel htmlFor={`derive-name-${it.id}`}>Name</FieldLabel>
                        <Input
                          id={`derive-name-${it.id}`}
                          autoComplete="off"
                          className="w-full"
                          value={it.createNew.name}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id
                                  ? {
                                      ...x,
                                      createNew: { ...x.createNew, name: e.target.value },
                                    }
                                  : x
                              )
                            )
                          }
                        />
                        {submitAttempted && !it.createNew.name.trim() ? (
                          <FieldError errors={[{ message: "Name is required" }]} />
                        ) : null}
                      </Field>

                      <div
                        className="mb-0 flex flex-col gap-2 border-t pt-3"
                        role="group"
                        aria-label="Common details"
                      >
                        <p className="text-sm font-medium">Details</p>

                        <Field className="gap-2">
                          <div className="flex flex-col gap-2 @md/field-group:flex-row @md/field-group:items-center @md/field-group:justify-between">
                            <div className="flex flex-col gap-0.5">
                              <FieldLabel htmlFor={`derive-graded-${it.id}`}>Graded</FieldLabel>
                              <FieldDescription>Whether the item is professionally graded.</FieldDescription>
                            </div>
                            <Switch
                              id={`derive-graded-${it.id}`}
                              checked={it.createNew.graded}
                              onCheckedChange={(checked) =>
                                setItems((prev) =>
                                  prev.map((x) =>
                                    x.id === it.id
                                      ? {
                                          ...x,
                                          createNew: { ...x.createNew, graded: checked },
                                        }
                                      : x
                                  )
                                )
                              }
                            />
                          </div>
                        </Field>

                        {it.createNew.graded ? (
                          <div className="flex flex-col gap-3">
                            <Field className="gap-2">
                              <FieldLabel htmlFor={`derive-provider-${it.id}`}>Provider</FieldLabel>
                              <Select
                                value={it.createNew.provider}
                                onValueChange={(v) => {
                                  if (!PROVIDERS.includes(v as any)) return
                                  setItems((prev) =>
                                    prev.map((x) =>
                                      x.id === it.id
                                        ? {
                                            ...x,
                                            createNew: { ...x.createNew, provider: v as any },
                                          }
                                        : x
                                    )
                                  )
                                }}
                              >
                                <SelectTrigger
                                  id={`derive-provider-${it.id}`}
                                  className="w-full"
                                  size="default"
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
                            </Field>

                            <Field className="gap-2">
                              <FieldLabel htmlFor={`derive-grade-${it.id}`}>Grade</FieldLabel>
                              <Input
                                id={`derive-grade-${it.id}`}
                                type="number"
                                inputMode="decimal"
                                step="any"
                                min={0}
                                placeholder="e.g. 10"
                                className="w-full"
                                value={it.createNew.grade}
                                onChange={(e) =>
                                  setItems((prev) =>
                                    prev.map((x) =>
                                      x.id === it.id
                                        ? {
                                            ...x,
                                            createNew: { ...x.createNew, grade: e.target.value },
                                          }
                                        : x
                                    )
                                  )
                                }
                              />
                            </Field>
                          </div>
                        ) : null}
                      </div>
                    </FieldGroup>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-left text-sm text-muted-foreground">
                    Choose a mode to continue.
                  </div>
                )}

              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    mode: null,
                    selectedBase: null,
                    chooseFromBase: {
                      graded: false,
                      provider: "PSA",
                      grade: "",
                    },
                    createNew: {
                      sourceImage: null,
                      sourceImageUrl: null,
                      gameTitle: null,
                      category: "Card",
                      cardNo: "",
                      name: "",
                      graded: false,
                      provider: "PSA",
                      grade: "",
                    },
                  },
                ])
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              Add another derived item
            </Button>

            <div className="mt-1 border-t pt-4">
              <div className="rounded-lg border bg-muted/30 p-3">
              <FieldGroup>
                <Field
                  className="gap-2"
                  data-invalid={
                    submitAttempted && (sets < 1 || sets > Math.max(0, sourceQuantity || 0))
                  }
                >
                  <FieldLabel htmlFor="derive-sets">Sets of derived items</FieldLabel>
                  <FieldDescription>
                    How many source items will be consumed. This produces the same number of
                    copies for every derived item you defined above. Max:{" "}
                    {Math.max(0, sourceQuantity || 0)}.
                  </FieldDescription>
                  <Input
                    id="derive-sets"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={Math.max(0, sourceQuantity || 0)}
                    step={1}
                    className="w-full"
                    value={String(sets)}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setSets(Number.isFinite(n) ? Math.trunc(n) : 1)
                    }}
                  />
                  {submitAttempted && sets > Math.max(0, sourceQuantity || 0) ? (
                    <FieldError
                      errors={[{ message: "Sets cannot be greater than current quantity" }]}
                    />
                  ) : null}
                </Field>
              </FieldGroup>
            </div>
            </div>
          </div>
          </div>

          <DialogFooter className="px-0 pb-5 sm:pb-6">
            <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setSubmitAttempted(true)
                  if (!canConfirm) return
                  setCostOpen(true)
                }}
              >
                Next
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardBaseDialog
        open={Boolean(pickingForId)}
        onOpenChange={(o) => {
          if (!o) setPickingForId(null)
        }}
        onSelect={(selected) => {
          if (!pickingItem) return
          setItems((prev) =>
            prev.map((x) =>
              x.id === pickingItem.id ? { ...x, selectedBase: selected } : x
            )
          )
          // Invalidate cached signed image for this draft so it refreshes when base changes.
          setPickedBaseImageUrls((prev) => {
            const next = { ...prev }
            delete next[pickingItem.id]
            return next
          })
          setPickingForId(null)
        }}
      />

      <DerivedItemCostDialog
        open={costOpen}
        onOpenChange={setCostOpen}
        sets={sets}
        maxSets={Math.max(0, sourceQuantity || 0)}
        targets={costTargets}
        onNext={({ perItemCosts }) => {
          setPerItemCosts(perItemCosts)
          setSummaryOpen(true)
        }}
      />

      <DeriveSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        sets={sets}
        sourceQuantity={Math.max(0, sourceQuantity || 0)}
        sourceCollectionItemId={_sourceCollectionItemId}
        sourceGraded={_sourceGraded}
        drafts={items}
        targets={costTargets}
        generalCosts={[]}
        perItemCosts={perItemCosts}
        onSubmitted={() => {
          setSummaryOpen(false)
          setCostOpen(false)
          onOpenChange(false)
          onSubmitted?.()
        }}
      />
    </>
  )
}

