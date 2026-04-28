import { useEffect, useState } from "react"

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

type CostType = "Grading" | "Postal" | "Other"

type CostEntry = {
  id: string
  date: string
  type: CostType
  description: string
  costHKD: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionItemId: string
  sourceQuantity: number
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

export function GradingCostDialog({
  open,
  onOpenChange,
  collectionItemId: _collectionItemId,
  sourceQuantity,
}: Props) {
  const [costs, setCosts] = useState<CostEntry[]>([])
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (open) return
    setCosts([])
    setQuantity(1)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,46rem)] overflow-y-auto sm:max-w-lg p-0">
        <div className="p-5 sm:p-6">
          <DialogHeader className="px-0">
            <DialogTitle>Grading costs</DialogTitle>
            <DialogDescription>
              Add any number of cost records (or none) for 1 collection item.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 rounded-xl border bg-card p-3">
            <FieldGroup>
              <Field className="gap-2">
                <FieldLabel htmlFor="grading-quantity">Quantity</FieldLabel>
                <Input
                  id="grading-quantity"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={1}
                  max={Math.max(0, sourceQuantity || 0)}
                  className="w-full"
                  value={String(quantity)}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setQuantity(Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 1)
                  }}
                />
              </Field>
            </FieldGroup>
          </div>

          <div className="mt-4 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">This collection</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCosts((prev) => [...prev, newEntry()])}
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
                        <FieldLabel htmlFor={`grade-date-${c.id}`}>Date</FieldLabel>
                        <Input
                          id={`grade-date-${c.id}`}
                          type="date"
                          value={c.date}
                          onChange={(e) =>
                            setCosts((prev) =>
                              prev.map((x) => (x.id === c.id ? { ...x, date: e.target.value } : x))
                            )
                          }
                        />
                      </Field>

                      <Field className="gap-2">
                        <FieldLabel htmlFor={`grade-type-${c.id}`}>Type</FieldLabel>
                        <Select
                          value={c.type}
                          onValueChange={(v) =>
                            setCosts((prev) =>
                              prev.map((x) =>
                                x.id === c.id
                                  ? { ...x, type: v as CostType, description: "" }
                                  : x
                              )
                            )
                          }
                        >
                          <SelectTrigger id={`grade-type-${c.id}`} className="w-full" size="default">
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
                          <FieldLabel htmlFor={`grade-desc-${c.id}`}>Description</FieldLabel>
                          <Input
                            id={`grade-desc-${c.id}`}
                            value={c.description}
                            onChange={(e) =>
                              setCosts((prev) =>
                                prev.map((x) =>
                                  x.id === c.id ? { ...x, description: e.target.value } : x
                                )
                              )
                            }
                          />
                        </Field>
                      ) : null}

                      <Field className="gap-2">
                        <FieldLabel htmlFor={`grade-cost-${c.id}`}>Cost</FieldLabel>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">
                            HKD$
                          </div>
                          <Input
                            id={`grade-cost-${c.id}`}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min={0}
                            className="pl-14"
                            value={c.costHKD}
                            onChange={(e) =>
                              setCosts((prev) =>
                                prev.map((x) =>
                                  x.id === c.id ? { ...x, costHKD: e.target.value } : x
                                )
                              )
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
                        onClick={() => setCosts((prev) => prev.filter((x) => x.id !== c.id))}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No costs.</p>
            )}
          </div>
        </div>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

