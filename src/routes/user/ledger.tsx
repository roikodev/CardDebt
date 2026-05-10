import { createFileRoute } from "@tanstack/react-router"

import { Ledger } from "@/pages/Ledger"

export const Route = createFileRoute("/user/ledger")({
  component: Ledger,
})

