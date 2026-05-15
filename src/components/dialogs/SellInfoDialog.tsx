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
import { Input } from "@/components/ui/input"
import { FormMoneyInput } from "@/components/form-input"
import { QuantityStepper } from "@/components/form-input/quantity-stepper"
import { supabase } from "@/lib/supabase"
import { toastSold } from "@/lib/toastI18n"
import type { SellChoice } from "@/components/dialogs/SellChooseItemDialog"

function todayISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  choice: SellChoice | null
  onBack?: () => void
  onSubmitted?: () => void
}

export function SellInfoDialog({ open, onOpenChange, choice, onBack, onSubmitted }: Props) {
  const { t } = useTranslation()
  const workerOrigin = import.meta.env.VITE_CF_WORKER_ORIGIN as string | undefined

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState<number>(0)
  const [sellingDate, setSellingDate] = useState<string>(todayISODate())
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const maxQty = choice?.available ?? 0
  const title = choice?.base?.name ?? t("dialogs.selectedItem")
  const gradeLabel =
    choice && choice.graded
      ? [choice.provider ?? "PSA", typeof choice.grade === "number" ? String(choice.grade) : null]
          .filter(Boolean)
          .join(" ")
      : choice
        ? t("dialogs.raw")
        : null

  const meta = [choice?.base?.game_title, choice?.base?.card_no, gradeLabel]
    .filter(Boolean)
    .join(" · ")

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    setPrice(0)
    setSellingDate(todayISODate())
    setQuantity(1)
    setImageUrl(null)
  }, [open])

  useEffect(() => {
    if (!choice) return
    setQuantity((q) => Math.max(1, Math.min(q, choice.available)))
  }, [choice])

  useEffect(() => {
    if (!open) return
    const path = choice?.base?.image_cloud_path ?? null
    if (!path || !workerOrigin?.trim()) {
      setImageUrl(null)
      return
    }

    let cancelled = false
    ;(async () => {
      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes.data.session?.access_token ?? null
      if (!token) return

      const base = workerOrigin.replace(/\/+$/, "")
      try {
        const res = await fetch(`${base}/signed?file=${encodeURIComponent(path)}&ttl=300`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = (await res.json()) as { url?: string }
        if (!data.url) return
        if (!cancelled) setImageUrl(data.url)
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [choice?.base?.image_cloud_path, open, workerOrigin])

  const canSubmit = useMemo(() => {
    if (!choice) return false
    if (saving) return false
    if (maxQty <= 0) return false
    return true
  }, [choice, maxQty, saving])

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    const userRes = await supabase.auth.getUser()
    const userId = userRes.data.user?.id ?? null
    if (!userId) {
      setError(t("dialogs.notSignedIn"))
      setSaving(false)
      return
    }

    if (!choice) {
      setError(t("dialogs.noItemSelected"))
      setSaving(false)
      return
    }

    const qty = Math.max(1, Math.min(quantity, choice.available))
    if (!Number.isFinite(price) || Number(price) < 0) {
      setError(t("dialogs.sellInfo.priceMin"))
      setSaving(false)
      return
    }

    const pickRes = choice.graded
      ? await supabase
          .from("user_collection")
          .select("id, user_collection_grading!inner(provider, grade)")
          .eq("user_id", userId)
          .eq("collection_item_id", choice.collection_item_id)
          .eq("graded", true)
          .eq("grading", false)
          .eq("derived", false)
          .eq("deleted", false)
          .eq("user_collection_grading.provider", choice.provider ?? "PSA")
          .eq("user_collection_grading.grade", Number(choice.grade) || 0)
          .order("created_at", { ascending: true })
          .limit(qty)
      : await supabase
          .from("user_collection")
          .select("id")
          .eq("user_id", userId)
          .eq("collection_item_id", choice.collection_item_id)
          .eq("graded", false)
          .eq("grading", false)
          .eq("derived", false)
          .eq("deleted", false)
          .order("created_at", { ascending: true })
          .limit(qty)

    if (pickRes.error) {
      setError(pickRes.error.message)
      setSaving(false)
      return
    }

    const ids = (pickRes.data ?? [])
      .map((r) => (r as { id: string | null }).id)
      .filter((v): v is string => Boolean(v))

    if (ids.length < qty) {
      setError(t("dialogs.sellInfo.notEnoughQty", { count: ids.length }))
      setSaving(false)
      return
    }

    const insertRes = await supabase.from("sell_entries").insert({
      user_id: userId,
      user_collection_id: ids[0],
      price_hkd: Number(price),
      quantity: qty,
      selling_date: sellingDate,
    })

    if (insertRes.error) {
      setError(insertRes.error.message)
      setSaving(false)
      return
    }

    const updRes = await supabase
      .from("user_collection")
      .update({ deleted: true })
      .eq("user_id", userId)
      .in("id", ids)
      .eq("deleted", false)

    if (updRes.error) {
      setError(updRes.error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onOpenChange(false)
    toastSold()
    onSubmitted?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,44rem)] overflow-x-hidden p-0 sm:max-w-md">
        <DialogBody className="px-0">
          <div className="p-4 pb-2">
            <DialogHeader>
              <DialogTitle>{t("dialogs.sellTitle")}</DialogTitle>
              <DialogDescription>{t("dialogs.sellInfo.description")}</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-4 pb-3">
            {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}

            <div className="rounded-xl border bg-card/40 p-3 text-left">
              <div className="overflow-hidden rounded-lg border bg-muted/20">
                <div className="aspect-[4/3] w-full bg-muted/30 max-h-52 sm:max-h-none">
                  {imageUrl ? (
                    <img src={imageUrl} alt={title} className="h-full w-full object-contain" />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-muted/40" />
                  )}
                </div>
              </div>

              <p className="mt-3 text-sm font-medium">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{meta || t("common.emDash")}</p>
              {choice ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("dialogs.availableCount", { count: choice.available })}
                </p>
              ) : null}
            </div>

            <div className="mt-3 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="text-xs font-medium text-muted-foreground">{t("dialogs.quantity")}</div>
                <QuantityStepper
                  id="sell-qty"
                  value={quantity}
                  onValueChange={setQuantity}
                  min={1}
                  max={maxQty || 1}
                  disabled={!choice || saving}
                />
              </div>

              <FormMoneyInput
                label={t("dialogs.priceHkdPerOne")}
                htmlFor="sell-price"
                inputProps={{
                  id: "sell-price",
                  type: "number",
                  inputMode: "decimal",
                  min: 0,
                  value: String(price),
                  onChange: (e) => setPrice(Number(e.currentTarget.value)),
                  disabled: saving,
                }}
              />

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">{t("dialogs.sellingDate")}</div>
                <Input
                  type="date"
                  value={sellingDate}
                  onChange={(e) => setSellingDate(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="px-0">
          <div className="flex w-full justify-end gap-2 px-4">
            <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
              {t("dialogs.back")}
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {t("dialogs.sell")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
