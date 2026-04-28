import { useEffect, useMemo, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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
}: Props) {
  const [perItemCosts, setPerItemCosts] = useState<Record<string, CostEntry[]>>({})

  const targetIds = useMemo(() => targets.map((t) => t.id), [targets])

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

  useEffect(() => {
    if (open) return
    setPerItemCosts({})
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,46rem)] overflow-y-auto sm:max-w-lg p-0">
        <div className="p-5 sm:p-6">
          <DialogHeader className="px-0">
            <DialogTitle>Derived item costs</DialogTitle>
            <DialogDescription>
              Add any number of cost records (or none) for 1 set. Sets: {sets} (max {maxSets}).
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            {targets.map((t) => {
              const costs = perItemCosts[t.id] ?? []
              return (
                <div key={t.id} className="rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.subtitle}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPerItemCosts((prev) => ({
                          ...prev,
                          [t.id]: [...(prev[t.id] ?? []), newEntry()],
                        }))
                      }
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Add
                    </Button>
                  </div>

                  {costs.length ? (
                    <div className="mt-3 space-y-3">
                      {costs.map((c) => (
                        <div key={c.id} className="rounded-lg border bg-muted/30 p-3">
                          <FieldGroup>
                            <Field className="gap-2">
                              <FieldLabel htmlFor={`item-${t.id}-date-${c.id}`}>Date</FieldLabel>
                              <Input
                                id={`item-${t.id}-date-${c.id}`}
                                type="date"
                                value={c.date}
                                onChange={(e) =>
                                  setPerItemCosts((prev) => ({
                                    ...prev,
                                    [t.id]: (prev[t.id] ?? []).map((x) =>
                                      x.id === c.id ? { ...x, date: e.target.value } : x
                                    ),
                                  }))
                                }
                              />
                            </Field>

                            <Field className="gap-2">
                              <FieldLabel htmlFor={`item-${t.id}-type-${c.id}`}>Type</FieldLabel>
                              <Select
                                value={c.type}
                                onValueChange={(v) =>
                                  setPerItemCosts((prev) => ({
                                    ...prev,
                                    [t.id]: (prev[t.id] ?? []).map((x) =>
                                      x.id === c.id
                                        ? { ...x, type: v as DerivedItemCostType, description: "" }
                                        : x
                                    ),
                                  }))
                                }
                              >
                                <SelectTrigger
                                  id={`item-${t.id}-type-${c.id}`}
                                  className="w-full"
                                  size="default"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="Grading">Grading</SelectItem>
                                    <SelectItem value="Postal">Postal</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </Field>

                            {c.type === "Other" ? (
                              <Field className="gap-2">
                                <FieldLabel htmlFor={`item-${t.id}-desc-${c.id}`}>Description</FieldLabel>
                                <Input
                                  id={`item-${t.id}-desc-${c.id}`}
                                  value={c.description}
                                  onChange={(e) =>
                                    setPerItemCosts((prev) => ({
                                      ...prev,
                                      [t.id]: (prev[t.id] ?? []).map((x) =>
                                        x.id === c.id ? { ...x, description: e.target.value } : x
                                      ),
                                    }))
                                  }
                                />
                              </Field>
                            ) : null}

                            <Field className="gap-2">
                              <FieldLabel htmlFor={`item-${t.id}-cost-${c.id}`}>Cost</FieldLabel>
                              <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">
                                  HKD$
                                </div>
                                <Input
                                  id={`item-${t.id}-cost-${c.id}`}
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  min={0}
                                  className="pl-14"
                                  value={c.costHKD}
                                  onChange={(e) =>
                                    setPerItemCosts((prev) => ({
                                      ...prev,
                                      [t.id]: (prev[t.id] ?? []).map((x) =>
                                        x.id === c.id ? { ...x, costHKD: e.target.value } : x
                                      ),
                                    }))
                                  }
                                />
                              </div>
                            </Field>
                          </FieldGroup>

                          <div className="mt-3 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPerItemCosts((prev) => ({
                                  ...prev,
                                  [t.id]: (prev[t.id] ?? []).filter((x) => x.id !== c.id),
                                }))
                              }
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No costs for this item.</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                onNext?.({ perItemCosts })
                onOpenChange(false)
              }}
            >
              Next
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

