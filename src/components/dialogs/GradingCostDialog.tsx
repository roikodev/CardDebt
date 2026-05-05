import { useEffect, useMemo, useState } from "react"

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
  FormQuantityStepper,
  FormSelectField,
  FormTextInput,
} from "@/components/form-input"
import { FieldGroup } from "@/components/ui/field"
import { Plus, Trash2 } from "lucide-react"
import { GradingCostSummaryDialog } from "@/components/dialogs/GradingCostSummaryDialog"

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
  onSubmitted?: () => void
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
  onSubmitted,
}: Props) {
  const [costs, setCosts] = useState<CostEntry[]>([])
  const [quantity, setQuantity] = useState(1)
  const [sendingDate, setSendingDate] = useState(todayISODate())
  const [summaryOpen, setSummaryOpen] = useState(false)

  const maxQuantity = useMemo(() => Math.max(0, sourceQuantity || 0), [sourceQuantity])
  const canNext = useMemo(() => quantity >= 1 && quantity <= maxQuantity, [maxQuantity, quantity])

  useEffect(() => {
    if (open) return
    setCosts([])
    setQuantity(1)
    setSendingDate(todayISODate())
    setSummaryOpen(false)
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90dvh,46rem)] overflow-x-hidden sm:max-w-lg p-0">
          <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
            <DialogHeader className="px-0">
              <DialogTitle>Grading costs</DialogTitle>
              <DialogDescription>
                Add any number of cost records (or none) for 1 collection item.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 rounded-xl border bg-card p-3">
              <FieldGroup>
                <FormQuantityStepper
                  label="Quantity"
                  id="grading-quantity"
                  value={quantity}
                  onValueChange={setQuantity}
                  min={1}
                  max={Math.max(1, maxQuantity)}
                  disabled={maxQuantity < 1}
                />

                <FormTextInput
                  label="Sending Date"
                  id="grading-sending-date"
                  type="date"
                  value={sendingDate}
                  onChange={(e) => setSendingDate(e.target.value)}
                />
              </FieldGroup>
            </div>

            <div className="mt-4 rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Cost</p>
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
                        <FormTextInput
                          label="Date"
                          id={`grade-date-${c.id}`}
                          type="date"
                          value={c.date}
                          onChange={(e) =>
                            setCosts((prev) =>
                              prev.map((x) =>
                                x.id === c.id ? { ...x, date: e.target.value } : x
                              )
                            )
                          }
                        />

                        <FormSelectField label="Type" htmlFor={`grade-type-${c.id}`}>
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
                            <SelectTrigger
                              id={`grade-type-${c.id}`}
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
                        </FormSelectField>

                        {c.type === "Other" ? (
                          <FormTextInput
                            label="Description"
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
                        ) : null}

                        <FormMoneyInput
                          label="Cost"
                          htmlFor={`grade-cost-${c.id}`}
                          inputProps={{
                            id: `grade-cost-${c.id}`,
                            type: "number",
                            inputMode: "decimal",
                            step: "any",
                            min: 0,
                            value: c.costHKD,
                            onChange: (e) =>
                              setCosts((prev) =>
                                prev.map((x) =>
                                  x.id === c.id ? { ...x, costHKD: e.target.value } : x
                                )
                              ),
                          }}
                        />
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
          </DialogBody>

          <DialogFooter className="px-0 pb-5 sm:pb-6">
            <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="button" onClick={() => setSummaryOpen(true)} disabled={!canNext}>
                Next
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GradingCostSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        collectionItemId={_collectionItemId}
        quantity={quantity}
        sendingDate={sendingDate}
        sourceQuantity={maxQuantity}
        costs={costs}
        onDone={() => {
          setSummaryOpen(false)
          onOpenChange(false)
          onSubmitted?.()
        }}
      />
    </>
  )
}

