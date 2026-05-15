import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CardBaseDialog, type CollectionBaseRow } from "@/components/dialogs/CardBaseDialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  FormFieldRow,
  FormQuantityStepper,
  FormSelectField,
  FormSwitchField,
  FormTextInput,
  FormToggleGroupField,
} from "@/components/form-input"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { GAME_TITLE_OPTIONS, type GameTitleValue } from "@/lib/gameTitles"
import { supabase } from "@/lib/supabase"
import {
  DerivedItemCostDialog,
  type DerivedItemCostTarget,
} from "./DerivedItemCostDialog"
import { DeriveSummaryDialog } from "@/components/dialogs/DeriveSummaryDialog"
import { DeriveGradedSelectionDialog } from "@/components/dialogs/DeriveGradedSelectionDialog"
import { LayoutGrid, Plus, PlusSquare, Trash2 } from "lucide-react"

type DeriveMode = "create_new" | "choose_from_base"

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
    gameTitle: GameTitleValue | null
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
  const { t } = useTranslation()
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
  const [gradedSelectionOpen, setGradedSelectionOpen] = useState(false)
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [costOpen, setCostOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [perItemCosts, setPerItemCosts] = useState<Record<string, import("./DerivedItemCostDialog").CostEntry[]>>({})

  const costTargets = useMemo<DerivedItemCostTarget[]>(() => {
    return items.map((it) => {
      const title =
        it.mode === "choose_from_base"
          ? it.selectedBase?.name ?? t("dialogs.derive.chooseFromBase")
          : it.mode === "create_new"
            ? it.createNew.name?.trim() || t("dialogs.derive.createNew")
            : t("dialogs.derive.unselected")

      const subtitle =
        it.mode === "choose_from_base"
          ? [it.selectedBase?.game_title, it.selectedBase?.card_no].filter(Boolean).join(" · ") || t("common.emDash")
          : it.mode === "create_new"
            ? [it.createNew.gameTitle, it.createNew.category === "Card" ? it.createNew.cardNo : null]
                .filter(Boolean)
                .join(" · ") || t("common.emDash")
            : t("common.emDash")

      const imageSrc =
        it.mode === "choose_from_base"
          ? pickedBaseImageUrls[it.id] ?? null
          : it.mode === "create_new"
            ? it.createNew.sourceImageUrl ?? null
            : null

      return { id: it.id, title, subtitle, imageSrc }
    })
  }, [items, pickedBaseImageUrls, t])

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
    // Keep form state when the dialog closes (Back/Cancel).
    // Reset only after the flow is successfully submitted.
    abortRef.current?.abort()
  }, [open])

  const resetFlow = () => {
    setPickedBaseImageUrls({})
    setSubmitAttempted(false)
    setGradedSelectionOpen(false)
    setSelectedSourceIds([])
    setCostOpen(false)
    setSummaryOpen(false)
    setPerItemCosts({})
    setSets(1)
    setItems((prev) =>
      prev.map((it) => {
        if (it.createNew.sourceImageUrl) URL.revokeObjectURL(it.createNew.sourceImageUrl)
        return {
          ...it,
          mode: null,
          selectedBase: null,
          chooseFromBase: { graded: false, provider: "PSA", grade: "" },
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
        }
      })
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90dvh,46rem)] overflow-x-hidden sm:max-w-lg p-0">
          <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
            <DialogHeader className="px-0">
              <DialogTitle>{t("dialogs.deriveTitle")}</DialogTitle>
              <DialogDescription>{t("dialogs.derive.introDescription")}</DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              {items.map((it, idx) => (
                <div key={it.id} className="min-w-0 overflow-hidden rounded-xl border bg-card p-3">
                <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {t("dialogs.derive.derivedItem", { number: idx + 1 })}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                    disabled={items.length === 1}
                    aria-label={t("dialogs.derive.removeItemAria")}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={it.mode === "create_new" ? "default" : "outline"}
                    className="min-w-0 h-auto min-h-24 flex-col items-center justify-center gap-2 px-2 py-3 text-center sm:h-24"
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
                      {t("dialogs.derive.createNew")}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant={it.mode === "choose_from_base" ? "default" : "outline"}
                    className="min-w-0 h-auto min-h-24 flex-col items-center justify-center gap-2 px-2 py-3 text-center sm:h-24"
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
                      {t("dialogs.derive.chooseFromBase")}
                    </span>
                  </Button>
                </div>

                {it.mode === "choose_from_base" ? (
                  <div className="mt-3 min-w-0 overflow-hidden rounded-lg border bg-muted/30 p-3">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted/30">
                          {pickedBaseImageUrls[it.id] ? (
                            <img
                              src={pickedBaseImageUrls[it.id]}
                              alt={it.selectedBase?.name ?? t("dialogs.derive.selectedItemAlt")}
                              className="h-full w-full object-cover object-left-top"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full animate-pulse bg-muted/50" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="break-words text-sm font-medium leading-snug">
                            {it.selectedBase?.name ?? t("dialogs.derive.noItemSelected")}
                          </p>
                          <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground">
                            {[it.selectedBase?.game_title, it.selectedBase?.card_no]
                              .filter(Boolean)
                              .join(" · ") || t("common.emDash")}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full shrink-0 sm:w-auto sm:self-start"
                        onClick={() => setPickingForId(it.id)}
                      >
                        {t("dialogs.derive.choose")}
                      </Button>
                    </div>

                    <FieldGroup
                      className="mb-0 mt-3 gap-3 border-t pt-3"
                      role="group"
                      aria-label={t("dialogs.commonDetailsAria")}
                    >
                      <p className="text-sm font-medium">{t("dialogs.details")}</p>

                      <FormSwitchField
                        id={`derive-base-graded-${it.id}`}
                        label={t("dialogs.graded")}
                        description={t("dialogs.gradedDescription")}
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

                      {it.chooseFromBase.graded ? (
                        <div className="flex flex-col gap-3">
                          <FormSelectField
                            label={t("dialogs.provider")}
                            htmlFor={`derive-base-provider-${it.id}`}
                          >
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
                                <SelectValue placeholder={t("dialogs.selectProvider")} />
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

                          <FormTextInput
                            label={t("dialogs.grade")}
                            id={`derive-base-grade-${it.id}`}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min={0}
                            placeholder={t("dialogs.gradePlaceholder")}
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
                        </div>
                      ) : null}
                    </FieldGroup>
                  </div>
                ) : it.mode === "create_new" ? (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                    <FieldGroup>
                      <FormFieldRow
                        label={t("dialogs.sourceImage")}
                        htmlFor={`derive-source-image-${it.id}`}
                        error={
                          submitAttempted && !it.createNew.sourceImage && !it.createNew.sourceImageUrl
                            ? t("dialogs.buyForm.sourceImageRequired")
                            : undefined
                        }
                        invalid={
                          submitAttempted && !it.createNew.sourceImage && !it.createNew.sourceImageUrl
                        }
                      >
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
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              document
                                .getElementById(`derive-source-image-${it.id}`)
                                ?.click()
                            }
                          >
                            {t("dialogs.choosePhoto")}
                          </Button>

                          {it.createNew.sourceImageUrl ? (
                            <div className="overflow-hidden rounded-lg border">
                              <img
                                src={it.createNew.sourceImageUrl}
                                alt={t("dialogs.selectedSourceAlt")}
                                className="max-h-64 w-full bg-muted/30 object-contain"
                              />
                            </div>
                          ) : null}
                        </div>
                      </FormFieldRow>

                      <FormSelectField
                        label={t("dialogs.gameTitle")}
                        htmlFor={`derive-game-title-${it.id}`}
                      >
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
                                        gameTitle: (v as GameTitleValue) ?? null,
                                      },
                                    }
                                  : x
                              )
                            )
                          }
                        >
                          <SelectTrigger id={`derive-game-title-${it.id}`} className="w-full" size="default">
                            <SelectValue placeholder={t("dialogs.selectGameTitle")} />
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

                      <FormToggleGroupField label={t("dialogs.productCategory")}>
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
                          <ToggleGroupItem
                            className="min-w-0 flex-1"
                            value="Card"
                            aria-label={t("dialogs.categoryCard")}
                          >
                            {t("dialogs.categoryCard")}
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            className="min-w-0 flex-1"
                            value="Product"
                            aria-label={t("dialogs.categoryProduct")}
                          >
                            {t("dialogs.categoryProduct")}
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </FormToggleGroupField>

                      {it.createNew.category === "Card" ? (
                        <FormTextInput
                          label={t("dialogs.cardNo")}
                          id={`derive-card-no-${it.id}`}
                          autoComplete="off"
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
                      ) : null}

                      <FormTextInput
                        label={t("dialogs.name")}
                        id={`derive-name-${it.id}`}
                        autoComplete="off"
                        error={
                          submitAttempted && !it.createNew.name.trim()
                            ? t("dialogs.buyForm.nameRequired")
                            : undefined
                        }
                        invalid={submitAttempted && !it.createNew.name.trim()}
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

                      <div
                        className="mb-0 flex flex-col gap-2 border-t pt-3"
                        role="group"
                        aria-label={t("dialogs.commonDetailsAria")}
                      >
                        <p className="text-sm font-medium">{t("dialogs.details")}</p>

                        <FormSwitchField
                          id={`derive-graded-${it.id}`}
                          label={t("dialogs.graded")}
                          description={t("dialogs.gradedDescription")}
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

                        {it.createNew.graded ? (
                          <div className="flex flex-col gap-3">
                            <FormSelectField
                              label={t("dialogs.provider")}
                              htmlFor={`derive-provider-${it.id}`}
                            >
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
                                  <SelectValue placeholder={t("dialogs.selectProvider")} />
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

                            <FormTextInput
                              label={t("dialogs.grade")}
                              id={`derive-grade-${it.id}`}
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min={0}
                              placeholder={t("dialogs.gradePlaceholder")}
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
                          </div>
                        ) : null}
                      </div>
                    </FieldGroup>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-left text-sm text-muted-foreground">
                    {t("dialogs.derive.chooseModeToContinue")}
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
              {t("dialogs.derive.addAnotherDerived")}
            </Button>

            <div className="mt-1 border-t pt-4">
              <div className="rounded-lg border bg-muted/30 p-3">
              <FieldGroup>
                <FormQuantityStepper
                  label={t("dialogs.derive.setsLabel")}
                  id="derive-sets"
                  htmlFor="derive-sets"
                  description={t("dialogs.derive.setsDescription", {
                    max: Math.max(0, sourceQuantity || 0),
                  })}
                  error={
                    submitAttempted && sets > Math.max(0, sourceQuantity || 0)
                      ? t("dialogs.derive.setsMaxError")
                      : undefined
                  }
                  invalid={
                    submitAttempted && (sets < 1 || sets > Math.max(0, sourceQuantity || 0))
                  }
                  value={sets}
                  onValueChange={setSets}
                  min={1}
                  max={Math.max(1, Math.max(0, sourceQuantity || 0))}
                  disabled={Math.max(0, sourceQuantity || 0) < 1}
                />
              </FieldGroup>
            </div>
            </div>
          </div>
          </DialogBody>

          <DialogFooter className="px-0 pb-5 sm:pb-6">
            <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("dialogs.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setSubmitAttempted(true)
                  if (!canConfirm) return
                  const setsInt = Math.max(0, Math.trunc(Number(sets) || 0))
                  if (_sourceGraded && setsInt > 0) {
                    setGradedSelectionOpen(true)
                    return
                  }
                  setCostOpen(true)
                }}
              >
                {t("dialogs.next")}
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

      <DeriveGradedSelectionDialog
        open={gradedSelectionOpen}
        onOpenChange={setGradedSelectionOpen}
        sourceCollectionItemId={_sourceCollectionItemId}
        requiredCount={Math.max(0, Math.trunc(Number(sets) || 0))}
        onConfirm={(ids) => {
          setSelectedSourceIds(ids)
          setCostOpen(true)
        }}
      />

      <DerivedItemCostDialog
        open={costOpen}
        onOpenChange={setCostOpen}
        sets={sets}
        maxSets={Math.max(0, sourceQuantity || 0)}
        targets={costTargets}
        onBack={() => {
          setCostOpen(false)
          const setsInt = Math.max(0, Math.trunc(Number(sets) || 0))
          if (_sourceGraded && setsInt > 0) setGradedSelectionOpen(true)
        }}
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
        sourceUserCollectionIds={selectedSourceIds.length ? selectedSourceIds : undefined}
        drafts={items}
        targets={costTargets}
        generalCosts={[]}
        perItemCosts={perItemCosts}
        onBack={() => {
          setSummaryOpen(false)
          setCostOpen(true)
        }}
        onSubmitted={() => {
          setSummaryOpen(false)
          setCostOpen(false)
          onOpenChange(false)
          resetFlow()
          onSubmitted?.()
        }}
      />
    </>
  )
}

