import { useEffect, useMemo, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FormMoneyInput,
  FormSelectField,
  FormTextInput,
} from "@/components/form-input"
import { FieldGroup } from "@/components/ui/field"
import { Plus, Trash2 } from "lucide-react"

export type DerivedItemCostType = "Grading" | "Postal" | "Other"

export type DerivedItemCostTarget = {
  id: string
  title: string
  subtitle: string
  imageSrc?: string | null
}

export type CostEntry = {
  id: string
  date: string
  type: DerivedItemCostType
  description: string
  costHKD: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sets: number
  maxSets: number
  targets: DerivedItemCostTarget[]
  onNext?: (payload: {
    perItemCosts: Record<string, CostEntry[]>
  }) => void
  onBack?: () => void
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random())
}

function todayISODate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function newEntry(): CostEntry {
  return {
    id: uid(),
    date: todayISODate(),
    type: "Grading",
    description: "",
    costHKD: "0",
  }
}

export function DerivedItemCostDialog({
  open,
  onOpenChange,
  sets,
  maxSets,
  targets,
  onNext,
  onBack,
}: Props) {
  const { t } = useTranslation()
  const [perItemCosts, setPerItemCosts] = useState<Record<string, CostEntry[]>>({})

  const targetIds = useMemo(() => targets.map((x) => x.id), [targets])

  useEffect(() => {
    if (!open) return
    setPerItemCosts((prev) => {
      const next: Record<string, CostEntry[]> = { ...prev }
      for (const id of targetIds) {
        if (!next[id]) next[id] = []
      }
      for (const existing of Object.keys(next)) {
        if (!targetIds.includes(existing)) delete next[existing]
      }
      return next
    })
  }, [open, targetIds])

  // Do not clear state on close; only clear when the overall flow is submitted.

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,46rem)] overflow-x-hidden sm:max-w-lg p-0">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>{t("dialogs.derivedCostsTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialogs.derivedItemCost.descriptionWithSets", { sets, maxSets })}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            {targets.map((target) => {
              const costs = perItemCosts[target.id] ?? []
              return (
                <div key={target.id} className="rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{target.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{target.subtitle}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPerItemCosts((prev) => ({
                          ...prev,
                          [target.id]: [...(prev[target.id] ?? []), newEntry()],
                        }))
                      }
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      {t("dialogs.add")}
                    </Button>
                  </div>

                  {costs.length ? (
                    <div className="mt-3 space-y-3">
                      {costs.map((c) => (
                        <div key={c.id} className="rounded-lg border bg-muted/30 p-3">
                          <FieldGroup>
                            <FormTextInput
                              label={t("dialogs.date")}
                              id={`item-${target.id}-date-${c.id}`}
                              type="date"
                              value={c.date}
                              onChange={(e) =>
                                setPerItemCosts((prev) => ({
                                  ...prev,
                                  [target.id]: (prev[target.id] ?? []).map((x) =>
                                    x.id === c.id ? { ...x, date: e.target.value } : x
                                  ),
                                }))
                              }
                            />

                            <FormSelectField
                              label={t("dialogs.typeLabel")}
                              htmlFor={`item-${target.id}-type-${c.id}`}
                            >
                              <Select
                                value={c.type}
                                onValueChange={(v) =>
                                  setPerItemCosts((prev) => ({
                                    ...prev,
                                    [target.id]: (prev[target.id] ?? []).map((x) =>
                                      x.id === c.id
                                        ? { ...x, type: v as DerivedItemCostType, description: "" }
                                        : x
                                    ),
                                  }))
                                }
                              >
                                <SelectTrigger
                                  id={`item-${target.id}-type-${c.id}`}
                                  className="w-full"
                                  size="default"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="Grading">
                                      {t("dialogs.costType.grading")}
                                    </SelectItem>
                                    <SelectItem value="Postal">
                                      {t("dialogs.costType.postal")}
                                    </SelectItem>
                                    <SelectItem value="Other">
                                      {t("dialogs.costType.other")}
                                    </SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </FormSelectField>

                            {c.type === "Other" ? (
                              <FormTextInput
                                label={t("dialogs.description")}
                                id={`item-${target.id}-desc-${c.id}`}
                                value={c.description}
                                onChange={(e) =>
                                  setPerItemCosts((prev) => ({
                                    ...prev,
                                    [target.id]: (prev[target.id] ?? []).map((x) =>
                                      x.id === c.id ? { ...x, description: e.target.value } : x
                                    ),
                                  }))
                                }
                              />
                            ) : null}

                            <FormMoneyInput
                              label={t("dialogs.cost")}
                              htmlFor={`item-${target.id}-cost-${c.id}`}
                              inputProps={{
                                id: `item-${target.id}-cost-${c.id}`,
                                type: "number",
                                inputMode: "decimal",
                                step: "any",
                                min: 0,
                                value: c.costHKD,
                                onChange: (e) =>
                                  setPerItemCosts((prev) => ({
                                    ...prev,
                                    [target.id]: (prev[target.id] ?? []).map((x) =>
                                      x.id === c.id ? { ...x, costHKD: e.target.value } : x
                                    ),
                                  })),
                              }}
                            />
                          </FieldGroup>

                          <div className="mt-3 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPerItemCosts((prev) => ({
                                  ...prev,
                                  [target.id]: (prev[target.id] ?? []).filter((x) => x.id !== c.id),
                                }))
                              }
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              {t("dialogs.remove")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("dialogs.derivedItemCost.noCostsForItem")}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </DialogBody>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (onBack) onBack()
                else onOpenChange(false)
              }}
            >
              {t("dialogs.back")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                onNext?.({ perItemCosts })
                onOpenChange(false)
              }}
            >
              {t("dialogs.next")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
