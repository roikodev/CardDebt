import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"

import cardDebtLogo from "@/assets/CardDebt.png"
import { supabase } from "@/lib/supabase"

type IndexLoaderData = {
  hasSession: boolean
}

export const Route = createFileRoute("/")({
  loader: async (): Promise<IndexLoaderData> => {
    const { data } = await supabase.auth.getSession()
    return { hasSession: !!data.session }
  },
  component: IndexSplash,
})

function IndexSplash() {
  const navigate = useNavigate()
  const { hasSession } = Route.useLoaderData()
  const [done, setDone] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const target = useMemo(
    () => (hasSession ? "/user/dashboard" : "/auth/home"),
    [hasSession]
  )

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches

  useEffect(() => {
    const durationMs = reduceMotion ? 250 : 1800
    const timeout = window.setTimeout(() => setDone(true), durationMs)
    return () => window.clearTimeout(timeout)
  }, [reduceMotion])

  useEffect(() => {
    if (!done) return
    setLeaving(true)
  }, [done])

  useEffect(() => {
    if (!leaving) return
    const fadeMs = reduceMotion ? 80 : 280
    const timeout = window.setTimeout(() => {
      navigate({ to: target, replace: true })
    }, fadeMs)
    return () => window.clearTimeout(timeout)
  }, [leaving, navigate, reduceMotion, target])

  return (
    <div className="fixed inset-0 isolate flex items-center justify-center overflow-hidden bg-background text-foreground carddebt-splash-root data-[leaving=true]:carddebt-splash-leave"
      data-leaving={leaving}
    >
      <div className="pointer-events-none absolute inset-0 opacity-80 carddebt-splash-bg" />

      <div className="relative flex flex-col items-center gap-4 px-6">
        <div className="relative carddebt-splash-ring">
          <div className="absolute inset-0 rounded-[28px] carddebt-splash-glow" />
          <img
            src={cardDebtLogo}
            alt="CardDebt"
            className="relative size-40 rounded-[28px] shadow-xl ring-1 ring-foreground/10 carddebt-splash-pop"
          />
        </div>
      </div>
    </div>
  )
}

