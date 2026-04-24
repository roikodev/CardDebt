import { createFileRoute } from "@tanstack/react-router"
import { MyCollection } from "@/pages/MyCollection"

export const Route = createFileRoute("/user/my-collection")({
  component: MyCollection,
})

