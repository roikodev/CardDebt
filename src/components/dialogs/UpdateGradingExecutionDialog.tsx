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
import { supabase } from "@/lib/supabase"
import { FormSelectField, FormTextInput } from "@/components/form-input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FieldGroup } from "@/components/ui/field"
import { toast } from "sonner"

const PROVIDERS = ["PSA"] as const

type Outcome = "graded" | "raw"

export type UpdateGradingExecutionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sendingRecordId: string
  userCollectionId: string
  onUpdated?: () => void
}

export function UpdateGradingExecutionDialog({
  open,
  onOpenChange,
  sendingRecordId,
  userCollectionId,
  onUpdated,
}: UpdateGradingExecutionDialogProps) {
  const [outcome, setOutcome] = useState<Outcome>("graded")
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("PSA")
  const [grade, setGrade] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = useMemo(() => {
    if (saving) return false
    if (outcome === "raw") return true
    const g = Number(grade)
    return Boolean(provider) && Number.isFinite(g) && g > 0
  }, [grade, outcome, provider, saving])

  useEffect(() => {
    if (!open) return
    setSaving(false)
    setError(null)
    // keep last choices; don't reset
  }, [open])

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

    // 1) Apply result to user_collection
    if (outcome === "graded") {
      const g = Number(grade)
      const upd = await supabase
        .from("user_collection")
        .update({ grading: false, graded: true })
        .eq("id", userCollectionId)
        .eq("user_id", userId)
        .eq("deleted", false)

      if (upd.error) {
        setError(upd.error.message)
        setSaving(false)
        return
      }

      const ins = await supabase.from("user_collection_grading").insert({
        user_collection_id: userCollectionId,
        provider,
        grade: g,
      })

      if (ins.error) {
        setError(ins.error.message)
        setSaving(false)
        return
      }
    } else {
      const upd = await supabase
        .from("user_collection")
        .update({ grading: false })
        .eq("id", userCollectionId)
        .eq("user_id", userId)
        .eq("deleted", false)

      if (upd.error) {
        setError(upd.error.message)
        setSaving(false)
        return
      }
    }

    // 2) Mark sending record executed (irreversible)
    const execUpd = await supabase
      .from("user_collection_sending_to_grade")
      .update({ executed: true })
      .eq("id", sendingRecordId)
      .eq("user_id", userId)
      .eq("executed", false)

    if (execUpd.error) {
      setError(execUpd.error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onOpenChange(false)
    toast.success("Updated successfully", { duration: 5000 })
    onUpdated?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,40rem)] overflow-x-hidden sm:max-w-md p-0">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>Update grading result</DialogTitle>
            <DialogDescription>
              Choose whether this item became graded or remains raw. Once executed, it will disappear from this list.
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">Result</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={outcome === "graded" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setOutcome("graded")}
                  disabled={saving}
                >
                  Graded
                </Button>
                <Button
                  type="button"
                  variant={outcome === "raw" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setOutcome("raw")}
                  disabled={saving}
                >
                  Remain Raw
                </Button>
              </div>
            </div>

            {outcome === "graded" ? (
              <div className="rounded-xl border bg-card p-3">
                <FieldGroup>
                  <FormSelectField label="Provider" htmlFor="grade-provider">
                    <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                      <SelectTrigger id="grade-provider" className="w-full" size="default">
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

                  <FormTextInput
                    label="Grade"
                    id="grade-value"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    placeholder="e.g. 10"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  />
                </FieldGroup>
              </div>
            ) : null}
          </div>
        </DialogBody>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
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

