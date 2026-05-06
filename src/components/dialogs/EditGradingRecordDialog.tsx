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
import { FieldGroup } from "@/components/ui/field"
import { FormMoneyInput, FormTextInput } from "@/components/form-input"
import { FormSelectField } from "@/components/form-input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { MiscCostLine } from "@/components/collection-info/types"
import { Plus, Trash2 } from "lucide-react"

type CostType = "Grading" | "Postal" | "Other"

type EditableLine = {
  id: string
  date: string
  type: CostType
  description: string
  price: string
  isNew?: boolean
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random())
}

function toEditable(line: MiscCostLine): EditableLine {
  // Defensive: older cached data may not include `id`.
  // Treat missing ids as "new" so we never PATCH with undefined.
  const safeId = (line as any)?.id as string | undefined
  const isNew = !safeId || String(safeId) === "undefined"
  return {
    id: isNew ? uid() : safeId,
    date: line.date,
    type: (line.type as CostType) || "Other",
    description: line.description ?? "",
    price: String(Number(line.price) || 0),
    isNew,
  }
}

export type EditGradingRecordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userCollectionId: string
  initialLines: MiscCostLine[]
  onSaved?: () => void
}

export function EditGradingRecordDialog({
  open,
  onOpenChange,
  userCollectionId,
  initialLines,
  onSaved,
}: EditGradingRecordDialogProps) {
  const [lines, setLines] = useState<EditableLine[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSaving(false)
    setError(null)
    setLines(initialLines.length ? initialLines.map(toEditable) : [])
  }, [initialLines, open])

  const canSave = useMemo(() => {
    if (saving) return false
    if (lines.length < 1) return false
    // Require date + type + non-negative price
    for (const l of lines) {
      if (!l.date?.trim()) return false
      if (!l.type) return false
      const p = Number(l.price)
      if (!Number.isFinite(p) || p < 0) return false
      if (l.type === "Other" && !l.description.trim()) return false
    }
    return true
  }, [lines, saving])

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)

    const userRes = await supabase.auth.getUser()
    const userId = userRes.data.user?.id ?? null
    if (!userId) {
      setError("You are not signed in.")
      setSaving(false)
      return
    }

    const existingIds = new Set(initialLines.map((l) => (l as any)?.id).filter(Boolean) as string[])
    const nextIds = new Set(lines.filter((l) => !l.isNew).map((l) => l.id).filter(Boolean))
    const removedIds = Array.from(existingIds).filter((id) => !nextIds.has(id))

    // 1) Delete removed mappings + entries
    if (removedIds.length) {
      const delMapRes = await supabase
        .from("user_collection_miscellaneous")
        .delete()
        .eq("user_id", userId)
        .eq("user_collection_id", userCollectionId)
        .in("miscellaneous_entries_id", removedIds)

      if (delMapRes.error) {
        setError(delMapRes.error.message)
        setSaving(false)
        return
      }

      const delMiscRes = await supabase
        .from("miscellaneous_entries")
        .delete()
        .eq("user_id", userId)
        .in("id", removedIds)

      if (delMiscRes.error) {
        setError(delMiscRes.error.message)
        setSaving(false)
        return
      }
    }

    // 2) Update existing entries
    const updates = lines.filter((l) => !l.isNew && l.id && l.id !== "undefined")
    for (const l of updates) {
      const upd = await supabase
        .from("miscellaneous_entries")
        .update({
          date: l.date,
          type: l.type,
          description: l.type === "Other" ? l.description.trim() : null,
          price: Number(l.price) || 0,
        })
        .eq("user_id", userId)
        .eq("id", l.id)

      if (upd.error) {
        setError(upd.error.message)
        setSaving(false)
        return
      }
    }

    // 3) Insert new entries + mappings
    const newLines = lines.filter((l) => l.isNew)
    if (newLines.length) {
      const miscRows = newLines.map((l) => ({
        user_id: userId,
        type: l.type,
        description: l.type === "Other" ? l.description.trim() : null,
        price: Number(l.price) || 0,
        date: l.date,
      }))

      const insRes = await supabase.from("miscellaneous_entries").insert(miscRows).select("id")
      if (insRes.error || !insRes.data?.length) {
        setError(insRes.error?.message ?? "Failed to create cost entries.")
        setSaving(false)
        return
      }

      const newIds = insRes.data.map((r) => (r as { id: string }).id).filter(Boolean)
      const mapRows = newIds.map((id) => ({
        user_id: userId,
        user_collection_id: userCollectionId,
        miscellaneous_entries_id: id,
      }))
      const mapRes = await supabase.from("user_collection_miscellaneous").insert(mapRows)
      if (mapRes.error) {
        setError(mapRes.error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onOpenChange(false)
    toast.success("Updated successfully", { duration: 5000 })
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90dvh,46rem)] overflow-x-hidden sm:max-w-lg p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>Edit grading costs</DialogTitle>
            <DialogDescription>
              Edit the cost lines for this grading record. You must keep at least 1 line.
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <div className="mt-4 space-y-3">
            {lines.map((l, idx) => (
              <div key={l.id} className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Cost line {idx + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={lines.length <= 1 || saving}
                    aria-label="Remove cost line"
                    onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>

                <FieldGroup>
                  <FormTextInput
                    label="Date"
                    id={`grading-edit-date-${l.id}`}
                    type="date"
                    value={l.date}
                    onChange={(e) =>
                      setLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, date: e.target.value } : x)))
                    }
                  />

                  <FormSelectField label="Type" htmlFor={`grading-edit-type-${l.id}`}>
                    <Select
                      value={l.type}
                      onValueChange={(v) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.id === l.id ? { ...x, type: v as CostType, description: "" } : x
                          )
                        )
                      }
                    >
                      <SelectTrigger id={`grading-edit-type-${l.id}`} className="w-full" size="default">
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

                  {l.type === "Other" ? (
                    <FormTextInput
                      label="Description"
                      id={`grading-edit-desc-${l.id}`}
                      value={l.description}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) => (x.id === l.id ? { ...x, description: e.target.value } : x))
                        )
                      }
                    />
                  ) : null}

                  <FormMoneyInput
                    label="Cost"
                    htmlFor={`grading-edit-price-${l.id}`}
                    inputProps={{
                      id: `grading-edit-price-${l.id}`,
                      type: "number",
                      inputMode: "decimal",
                      step: "any",
                      min: 0,
                      value: l.price,
                      onChange: (e) =>
                        setLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, price: e.target.value } : x))),
                    }}
                  />
                </FieldGroup>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={saving}
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    date: new Date().toISOString().slice(0, 10),
                    type: "Grading",
                    description: "",
                    price: "0",
                    isNew: true,
                  },
                ])
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              Add cost line
            </Button>
          </div>
        </DialogBody>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Back
            </Button>
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

