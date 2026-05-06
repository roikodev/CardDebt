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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { GradedChip } from "@/components/GradedChip"

type CollectionBase = {
  id: string
  game_title: string | null
  card_no: string | null
  name: string | null
  image_cloud_path: string | null
}

export type SellChoice = {
  key: string
  collection_item_id: string
  graded: boolean
  provider?: string | null
  grade?: number | null
  available: number
  base: CollectionBase | null
}

function SellChoiceTile({
  choice,
  workerOrigin,
  onSelect,
}: {
  choice: SellChoice
  workerOrigin?: string
  onSelect: () => void
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const filePath = choice.base?.image_cloud_path
    if (!filePath || !workerOrigin) return

    const fetchUrl = async () => {
      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token
      if (!token) return

      try {
        const baseUrl = workerOrigin.replace(/\/+$/, "")
        const url = `${baseUrl}/signed?file=${encodeURIComponent(filePath)}&ttl=300`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (isMounted && data.url) setImgUrl(data.url)
      } catch {
        /* ignore */
      }
    }

    fetchUrl()
    return () => {
      isMounted = false
    }
  }, [choice.base?.image_cloud_path, workerOrigin])

  const name = choice.base?.name ?? "Untitled"
  const meta = [choice.base?.game_title, choice.base?.card_no].filter(Boolean).join(" · ")

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative block w-full cursor-pointer overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
        {choice.available}
      </div>
      <div className="aspect-[4/3] w-full bg-muted/30">
        {imgUrl ? (
          <img src={imgUrl} alt={name} className="h-full w-full object-cover object-left-top" loading="lazy" />
        ) : (
          <div className="h-full w-full animate-pulse bg-muted/50" />
        )}
      </div>
      <div className="flex min-h-[92px] flex-col gap-1 p-3">
        <div className="min-h-5">
          {choice.graded ? (
            <GradedChip
              provider={choice.provider ?? "PSA"}
              grade={Number(choice.grade) || 0}
              count={choice.available}
              tone="light"
            />
          ) : (
            <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-semibold leading-none text-foreground">
              Raw
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-sm font-medium leading-snug">{name}</p>
        <p className="text-xs text-muted-foreground">{meta || "—"}</p>
      </div>
    </button>
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (choice: SellChoice) => void
}

export function SellChooseItemDialog({ open, onOpenChange, onSelect }: Props) {
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [choices, setChoices] = useState<SellChoice[]>([])

  const [nameQuery, setNameQuery] = useState("")
  const [cardNoQuery, setCardNoQuery] = useState("")
  const [gameTitle, setGameTitle] = useState<string | null>(null)
  const [debouncedName, setDebouncedName] = useState("")
  const [debouncedCardNo, setDebouncedCardNo] = useState("")

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedName(nameQuery), 250)
    return () => window.clearTimeout(id)
  }, [nameQuery])

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedCardNo(cardNoQuery), 250)
    return () => window.clearTimeout(id)
  }, [cardNoQuery])

  useEffect(() => {
    if (!open) return
    setError(null)
    setChoices([])
    setLoading(true)
    setNameQuery("")
    setCardNoQuery("")
    setGameTitle(null)
    setDebouncedName("")
    setDebouncedCardNo("")

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
        .select(
          "id, graded, collection_item_id, collection_base:collection_item_id ( id, game_title, card_no, name, image_cloud_path ), user_collection_grading:user_collection_grading ( provider, grade )"
        )
        .eq("user_id", userId)
        .eq("grading", false)
        .eq("derived", false)
        .eq("deleted", false)

      if (res.error) {
        setError(res.error.message)
        setLoading(false)
        return
      }

      const rows = (res.data ?? []) as unknown as Array<{
        graded: boolean
        collection_item_id: string
        collection_base: CollectionBase | CollectionBase[] | null
        user_collection_grading:
          | { provider: string; grade: number }
          | { provider: string; grade: number }[]
          | null
      }>

      const map = new Map<string, SellChoice>()
      for (const r of rows) {
        const gRaw = r.user_collection_grading
        const g = Array.isArray(gRaw) ? gRaw[0] ?? null : gRaw ?? null
        const provider = g?.provider ?? null
        const grade = typeof g?.grade === "number" ? g.grade : null

        const key = r.graded
          ? `${r.collection_item_id}:1:${provider ?? "?"}:${grade ?? "?"}`
          : `${r.collection_item_id}:0`
        const baseRaw = r.collection_base
        const base = Array.isArray(baseRaw) ? baseRaw[0] ?? null : baseRaw
        const existing = map.get(key)
        if (existing) existing.available += 1
        else
          map.set(key, {
            key,
            collection_item_id: r.collection_item_id,
            graded: Boolean(r.graded),
            provider,
            grade,
            available: 1,
            base,
          })
      }

      const list = Array.from(map.values()).sort((a, b) => b.available - a.available)
      setChoices(list)
      setLoading(false)
    })()
  }, [open])

  const subtitle = useMemo(() => {
    if (loading) return "Loading your items…"
    if (error) return "Could not load items."
    return "Choose an item from your collection to sell."
  }, [error, loading])

  const allGameTitles = useMemo(() => {
    const set = new Set<string>()
    for (const c of choices) {
      const t = c.base?.game_title
      if (t) set.add(t)
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b))
  }, [choices])

  const filteredChoices = useMemo(() => {
    const nq = debouncedName.trim().toLowerCase()
    const cq = debouncedCardNo.trim().toLowerCase()
    const gt = gameTitle?.trim() ? gameTitle : null

    return choices.filter((c) => {
      const b = c.base
      if (gt && (b?.game_title ?? "") !== gt) return false
      if (nq && !(b?.name ?? "").toLowerCase().includes(nq)) return false
      if (cq && !(b?.card_no ?? "").toLowerCase().includes(cq)) return false
      return true
    })
  }, [choices, debouncedCardNo, debouncedName, gameTitle])

  const { gradedChoices, rawChoices } = useMemo(() => {
    const nameOf = (c: SellChoice) => (c.base?.name ?? "").trim().toLowerCase()
    const providerOf = (c: SellChoice) => (c.provider ?? "").trim().toLowerCase()
    const gradeOf = (c: SellChoice) => (typeof c.grade === "number" ? c.grade : -1)

    const graded = filteredChoices
      .filter((c) => c.graded)
      .sort((a, b) => {
        const an = nameOf(a)
        const bn = nameOf(b)
        if (an !== bn) return an.localeCompare(bn)
        const ap = providerOf(a)
        const bp = providerOf(b)
        if (ap !== bp) return ap.localeCompare(bp)
        return gradeOf(b) - gradeOf(a) // desc
      })

    const raw = filteredChoices
      .filter((c) => !c.graded)
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))

    return { gradedChoices: graded, rawChoices: raw }
  }, [filteredChoices])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,44rem)] overflow-x-hidden p-0 sm:max-w-3xl">
        <DialogBody className="px-0">
          <div className="p-4 pb-2">
            <DialogHeader>
              <DialogTitle>Sell</DialogTitle>
              <DialogDescription>{subtitle}</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-4 pb-4">
            {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

            {!loading ? (
              <div className="mb-4 rounded-xl border bg-card/40 p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} placeholder="Name" />
                  <Input
                    value={cardNoQuery}
                    onChange={(e) => setCardNoQuery(e.target.value)}
                    placeholder="Card Number"
                  />
                  <Select value={gameTitle ?? "__all__"} onValueChange={(v) => setGameTitle(v === "__all__" ? null : v)}>
                    <SelectTrigger className="w-full" size="default">
                      <SelectValue placeholder="Game title" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="__all__">All game titles</SelectItem>
                        {allGameTitles.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : choices.length === 0 ? (
              <div className="rounded-xl border bg-card/40 p-3 text-sm text-muted-foreground">
                No eligible items to sell. (Only items with <span className="font-medium">grading=false</span> and{" "}
                <span className="font-medium">derived=false</span> can be sold.)
              </div>
            ) : gradedChoices.length === 0 && rawChoices.length === 0 ? (
              <div className="rounded-xl border bg-card/40 p-3 text-sm text-muted-foreground">
                No items match the current filters.
              </div>
            ) : (
              <div className="space-y-6">
                {gradedChoices.length ? (
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Graded</h3>
                      <span className="text-xs text-muted-foreground">{gradedChoices.length} groups</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                      {gradedChoices.map((c) => (
                        <SellChoiceTile
                          key={c.key}
                          choice={c}
                          workerOrigin={workerOrigin}
                          onSelect={() => {
                            onOpenChange(false)
                            onSelect(c)
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {rawChoices.length ? (
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Raw</h3>
                      <span className="text-xs text-muted-foreground">{rawChoices.length} groups</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                      {rawChoices.map((c) => (
                        <SellChoiceTile
                          key={c.key}
                          choice={c}
                          workerOrigin={workerOrigin}
                          onSelect={() => {
                            onOpenChange(false)
                            onSelect(c)
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="px-0">
          <div className="flex w-full justify-end gap-2 px-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

