import { createFileRoute } from "@tanstack/react-router"
import { CollectionInfo } from "@/pages/CollectionInfo"
import { z } from "zod"

export const Route = createFileRoute("/user/my-collection/$collection_item_id")({
  validateSearch: z.object({
    graded: z
      .union([z.boolean(), z.string(), z.number()])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined
        if (typeof v === "boolean") return v
        if (typeof v === "number") return v === 1
        const s = v.toLowerCase()
        if (s === "true" || s === "1") return true
        if (s === "false" || s === "0") return false
        return undefined
      }),
  }),
  component: CollectionInfo,
})

