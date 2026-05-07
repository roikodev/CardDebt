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
import { FieldGroup } from "@/components/ui/field"
import { FormMoneyInput, FormSelectField, FormTextInput } from "@/components/form-input"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

type MiscType = "Grading" | "Postal" | "Other"

function todayISODate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted?: () => void
}

export function MiscellaneousEntryDialog({ open, onOpenChange, onSubmitted }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [date, setDate] = useState(todayISODate())
  const [type, setType] = useState<MiscType>("Grading")
  const [description, setDescription] = useState("")
  const [costHKD, setCostHKD] = useState("0")

  useEffect(() => {
    if (!open) return
    setSaving(false)
    setError(null)
    setDate(todayISODate())
    setType("Grading")
    setDescription("")
    setCostHKD("0")
  }, [open])

  const canSubmit = useMemo(() => {
    if (saving) return false
    if (!date.trim()) return false
    if (type === "Other" && !description.trim()) return false
    const n = Number(costHKD)
    if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return false
    return true
  }, [costHKD, date, description, saving, type])

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    const userRes = await supabase.auth.getUser()
    const userId = userRes.data.user?.id ?? null
    if (!userId) {
      setError("You are not signed in.")
      setSaving(false)
      return
    }

    const insRes = await supabase.from("miscellaneous_entries").insert({
      user_id: userId,
      type,
      description: type === "Other" ? description.trim() : null,
      price: Number(costHKD) || 0,
      date,
    })

    if (insRes.error) {
      setError(insRes.error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onOpenChange(false)
    toast.success("Saved successfully", { duration: 5000 })
    onSubmitted?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,34rem)] overflow-x-hidden p-0 sm:max-w-md">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>Miscellaneous</DialogTitle>
            <DialogDescription>Add a single miscellaneous record.</DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <div className="mt-4 rounded-xl border bg-card p-3">
            <FieldGroup>
              <FormTextInput
                label="Date"
                id="misc-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
              />

              <FormSelectField label="Type" htmlFor="misc-type">
                <Select value={type} onValueChange={(v) => setType(v as MiscType)} disabled={saving}>
                  <SelectTrigger id="misc-type" className="w-full" size="default">
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

              {type === "Other" ? (
                <FormTextInput
                  label="Description"
                  id="misc-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                />
              ) : null}

              <FormMoneyInput
                label="Cost"
                htmlFor="misc-cost"
                inputProps={{
                  id: "misc-cost",
                  type: "number",
                  inputMode: "decimal",
                  min: 0,
                  value: costHKD,
                  onChange: (e) => setCostHKD(e.currentTarget.value),
                  disabled: saving,
                }}
              />
            </FieldGroup>
          </div>
        </DialogBody>

        <DialogFooter className="px-0">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Back
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

