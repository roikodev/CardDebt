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
import { toast } from "sonner"

const GAME_TITLES = ["Pokemon JP", "YGO OCG", "BS"] as const
const NONE = "__none__"

async function preprocessImageForUpload(input: File): Promise<File> {
  const MAX_DIM = 2048
  const QUALITY = 0.82
  if (!input.type.startsWith("image/")) return input

  const bitmap = await createImageBitmap(input)
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const targetW = Math.max(1, Math.round(bitmap.width * scale))
  const targetH = Math.max(1, Math.round(bitmap.height * scale))

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(targetW, targetH)
      : Object.assign(document.createElement("canvas"), { width: targetW, height: targetH })

  const ctx = (canvas as HTMLCanvasElement).getContext
    ? (canvas as HTMLCanvasElement).getContext("2d")
    : (canvas as OffscreenCanvas).getContext("2d")

  if (!ctx) return input

  ;(ctx as CanvasRenderingContext2D).drawImage(bitmap as unknown as CanvasImageSource, 0, 0, targetW, targetH)
  bitmap.close?.()

  const toBlob = async (type: string, quality: number): Promise<Blob | null> => {
    if ("convertToBlob" in canvas) {
      try {
        return await (canvas as OffscreenCanvas).convertToBlob({ type, quality })
      } catch {
        return null
      }
    }
    return await new Promise<Blob | null>((resolve) => {
      ;(canvas as HTMLCanvasElement).toBlob((b) => resolve(b), type, quality)
    })
  }

  const webpBlob = await toBlob("image/webp", QUALITY)
  const outBlob = webpBlob && webpBlob.size > 0 ? webpBlob : await toBlob("image/jpeg", QUALITY)
  if (!outBlob || outBlob.size === 0) return input

  const baseName = (input.name || "image").replace(/\\.[^.]+$/, "")
  const outType = outBlob.type || "image/jpeg"
  const outExt = outType === "image/webp" ? "webp" : "jpg"
  return new File([outBlob], `${baseName}.${outExt}`, { type: outType })
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionItemId: string
  workerOrigin?: string
  initial: { name: string | null; game_title: string | null; card_no: string | null; image_cloud_path: string | null }
  onEdited?: () => void
}

export function EditCollectionBaseDialog({ open, onOpenChange, collectionItemId, workerOrigin, initial, onEdited }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [name, setName] = useState("")
  const [gameTitle, setGameTitle] = useState<string | null>(null)
  const [cardNo, setCardNo] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSaving(false)
    setError(null)
    setName(initial.name ?? "")
    setGameTitle(initial.game_title ?? null)
    setCardNo(initial.card_no ?? "")
    setImageFile(null)
    setPreviewUrl(null)
    setExistingImageUrl(null)
  }, [open, initial.card_no, initial.game_title, initial.name])

  useEffect(() => {
    if (!imageFile) return
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  // Show current saved image (signed URL) when opening dialog.
  useEffect(() => {
    if (!open) return
    if (!workerOrigin?.trim()) return
    const path = initial.image_cloud_path
    if (!path) return

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
        if (!cancelled) setExistingImageUrl(data.url)
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, workerOrigin, initial.image_cloud_path])

  const canSave = useMemo(() => {
    if (!collectionItemId) return false
    if (saving) return false
    return true
  }, [collectionItemId, saving])

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)

    const sessionRes = await supabase.auth.getSession()
    const session = sessionRes.data.session
    const userId = session?.user?.id ?? null
    const accessToken = session?.access_token ?? null

    if (!userId || !accessToken) {
      setError("You are not signed in.")
      setSaving(false)
      return
    }

    let imagePath: string | null = initial.image_cloud_path ?? null
    if (imageFile) {
      if (!workerOrigin) {
        setError("Missing VITE_CF_WORKER_ORIGIN in .env")
        setSaving(false)
        return
      }

      let file: File
      try {
        file = await preprocessImageForUpload(imageFile)
      } catch {
        file = imageFile
      }

      const originalName = file.name || "image"
      const dot = originalName.lastIndexOf(".")
      const extRaw = dot >= 0 ? originalName.slice(dot + 1) : ""
      const ext = extRaw.trim().toLowerCase() || "jpg"

      const imageName =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())

      imagePath = `${userId}/${imageName}.${ext}`
      const base = workerOrigin.replace(/\/+$/, "")
      const uploadUrl = `${base}/?file=${encodeURIComponent(imagePath)}`

      let uploadRes: Response
      try {
        uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        })
      } catch {
        setError(`Image upload failed: could not reach Worker (${base}).`)
        setSaving(false)
        return
      }

      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => "")
        setError(`Image upload failed (${uploadRes.status}). ${text}`.trim())
        setSaving(false)
        return
      }
    }

    const payload: {
      name: string | null
      game_title: string | null
      card_no: string | null
      image_cloud_path: string | null
    } = {
      name: name.trim() || null,
      game_title: gameTitle?.trim() || null,
      card_no: cardNo.trim() || null,
      image_cloud_path: imagePath,
    }

    const updRes = await supabase
      .from("collection_base")
      .update(payload)
      .eq("id", collectionItemId)
      .eq("user_id", userId)

    if (updRes.error) {
      setError(updRes.error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onOpenChange(false)
    toast.success("Updated successfully", { duration: 5000 })
    onEdited?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,34rem)] overflow-x-hidden sm:max-w-md p-0">
        <DialogBody className="px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="px-0">
            <DialogTitle>Edit item</DialogTitle>
            <DialogDescription>Update the item’s information.</DialogDescription>
          </DialogHeader>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Image</div>
              <div className="flex flex-col gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  disabled={saving}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                >
                  Choose / Take photo
                </Button>

                {previewUrl || existingImageUrl ? (
                  <div className="overflow-hidden rounded-lg border">
                    <img
                      src={previewUrl ?? existingImageUrl ?? ""}
                      alt="Selected source"
                      className="max-h-64 w-full bg-muted/30 object-contain"
                    />
                  </div>
                ) : null}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Name</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Game Title</div>
              <Select
                value={gameTitle ?? NONE}
                onValueChange={(v) => setGameTitle(v === NONE ? null : v)}
              >
                <SelectTrigger className="w-full" size="default">
                  <SelectValue placeholder="Select game title" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NONE}>None</SelectItem>
                    {GAME_TITLES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Card Number</div>
              <Input value={cardNo} onChange={(e) => setCardNo(e.target.value)} placeholder="Card Number" />
            </div>
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

