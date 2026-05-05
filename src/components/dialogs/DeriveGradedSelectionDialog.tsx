import { useEffect, useMemo, useRef, useState } from "react"

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
import { FormQuantityStepper } from "@/components/form-input"

type GradingDetail = { provider: string; grade: number } | { provider: string; grade: number }[] | null

type SelectableRow = {
  id: string
  created_at: string
  grading: boolean | null
  user_collection_grading: GradingDetail
}

type LevelKey = string

function levelKeyOf(row: SelectableRow): { key: LevelKey; provider: string | null; grade: number | null } {
  const raw = row.user_collection_grading
  const g = Array.isArray(raw) ? raw[0] : raw ?? null
  const provider = g?.provider ?? null
  const grade = typeof g?.grade === "number" ? g.grade : null
  if (!provider || grade == null) return { key: "ungraded", provider: null, grade: null }
  return { key: `${provider}:${grade}`, provider, grade }
}

export type DeriveGradedSelectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceCollectionItemId: string
  requiredCount: number
  onConfirm: (selectedUserCollectionIds: string[]) => void
}

export function DeriveGradedSelectionDialog({
  open,
  onOpenChange,
  sourceCollectionItemId,
  requiredCount,
  onConfirm,
}: DeriveGradedSelectionDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<SelectableRow[]>([])
  const [selectedByLevel, setSelectedByLevel] = useState<Record<LevelKey, number>>({})
  const abortRef = useRef<AbortController | null>(null)
  const lastSourceIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      abortRef.current = null
      return
    }

    const sourceChanged = lastSourceIdRef.current !== sourceCollectionItemId
    lastSourceIdRef.current = sourceCollectionItemId

    // Only reset selection when the source changes.
    if (sourceChanged) {
      setSelectedByLevel({})
    }

    // Keep previous rows while fetching so "Back" retains state.
    setLoading(true)
    setError(null)

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    ;(async () => {
      const userRes = await supabase.auth.getUser()
      const userId = userRes.data.user?.id ?? null
      if (!userId) {
        setError("You are not signed in.")
        setLoading(false)
        return
      }

      const res = await supabase
        .from("user_collection")
        .select("id, created_at, grading, user_collection_grading:user_collection_grading ( provider, grade )")
        .eq("user_id", userId)
        .eq("collection_item_id", sourceCollectionItemId)
        .eq("graded", true)
        .eq("derived", false)
        .eq("grading", false)
        .eq("deleted", false)
        .order("created_at", { ascending: true })

      if (signal.aborted) return

      if (res.error) {
        setError(res.error.message)
        setLoading(false)
        return
      }

      setRows((res.data ?? []) as SelectableRow[])
      setLoading(false)
    })()

    return () => abortRef.current?.abort()
  }, [open, sourceCollectionItemId])

  const groups = useMemo(() => {
    const map = new Map<
      LevelKey,
      { key: LevelKey; provider: string | null; grade: number | null; rows: SelectableRow[] }
    >()
    for (const r of rows) {
      const { key, provider, grade } = levelKeyOf(r)
      const existing = map.get(key)
      if (existing) existing.rows.push(r)
      else map.set(key, { key, provider, grade, rows: [r] })
    }

    return Array.from(map.values())
      .map((g) => ({
        ...g,
        rows: [...g.rows].sort((a, b) => a.created_at.localeCompare(b.created_at)),
        count: g.rows.length,
      }))
      .sort((a, b) => {
        const ag = a.grade ?? -1
        const bg = b.grade ?? -1
        return bg - ag
      })
  }, [rows])

  const totalSelected = useMemo(() => {
    return Object.values(selectedByLevel).reduce((sum, n) => sum + (Number(n) || 0), 0)
  }, [selectedByLevel])

  useEffect(() => {
    if (!open) return
    if (!rows.length) return
    if (requiredCount <= 0) return

    // Helpful default: if the user is deriving all available items, preselect all.
    if (requiredCount === rows.length) {
      setSelectedByLevel((prev) => {
        // Don't override an existing selection (retain state when going Back).
        if (Object.keys(prev).length) return prev
        const next: Record<LevelKey, number> = {}
        for (const g of groups) next[g.key] = g.count
        return next
      })
    }
  }, [groups, open, requiredCount, rows.length])

  const canConfirm = totalSelected === requiredCount && requiredCount > 0
  const remaining = Math.max(0, requiredCount - totalSelected)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,44rem)] overflow-x-hidden sm:max-w-lg p-0">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>Select graded items to derive</DialogTitle>
            <DialogDescription>
              You have multiple grading levels under the same card. Select exactly{" "}
              <span className="font-semibold">{requiredCount}</span> item{requiredCount === 1 ? "" : "s"} to consume.
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">Available</p>
              {loading ? (
                <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
              ) : (
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {groups.length ? (
                    groups.map((lvl) => (
                      <span
                        key={lvl.key}
                        className="inline-flex items-center rounded-full border bg-muted/30 px-2 py-0.5 text-xs font-semibold text-foreground"
                      >
                        {lvl.provider && typeof lvl.grade === "number"
                          ? `${lvl.provider} ${lvl.grade} × ${lvl.count}`
                          : `Unknown × ${lvl.count}`}
                      </span>
                    ))
                  ) : (
                    <span>—</span>
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Selected: <span className="font-semibold text-foreground">{totalSelected}</span>
                {requiredCount ? (
                  <>
                    {" "}
                    / {requiredCount}{" "}
                    {remaining ? (
                      <span className="text-muted-foreground">(need {remaining} more)</span>
                    ) : null}
                  </>
                ) : null}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-3">
              <p className="text-sm font-semibold">Choose quantities by grade</p>
              {loading ? (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: Math.max(3, Math.min(6, requiredCount || 3)) }).map((_, i) => (
                    <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No available graded items.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {groups.map((g) => {
                    const current = selectedByLevel[g.key] ?? 0
                    const totalOther = totalSelected - current
                    const maxForThis = Math.max(0, Math.min(g.count, requiredCount - totalOther))
                    const label =
                      g.provider && typeof g.grade === "number" ? `${g.provider} ${g.grade}` : "Unknown grade"
                    return (
                      <div key={g.key} className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Available: {g.count}</p>
                          </div>

                          <div className="shrink-0">
                            <FormQuantityStepper
                              label="Derive"
                              id={`derive-graded-${g.key}`}
                              className="gap-2"
                              value={current}
                              onValueChange={(v) => {
                                const next = Math.max(0, Math.min(v, maxForThis))
                                setSelectedByLevel((prev) => ({ ...prev, [g.key]: next }))
                              }}
                              min={0}
                              max={maxForThis}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {requiredCount > rows.length ? (
                    <p className="text-sm text-destructive">
                      Not enough available items to select {requiredCount}.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="px-0 pb-5 sm:pb-6">
          <div className="flex w-full justify-end gap-2 px-5 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                if (!canConfirm) return
                const ids: string[] = []
                for (const g of groups) {
                  const n = Math.max(0, Math.trunc(selectedByLevel[g.key] ?? 0))
                  if (!n) continue
                  ids.push(...g.rows.slice(0, n).map((r) => r.id))
                }
                onConfirm(ids.slice(0, requiredCount))
                onOpenChange(false)
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

