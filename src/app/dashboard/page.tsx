"use client"

import { Suspense, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { OneFlow } from "@/components/flow/one-flow"

function Dashboard() {
  const { status } = useSession()
  // Session refreshes (after a tailor, after checkout) briefly report "loading". Only the
  // first load may show the placeholder; unmounting the flow later would lose its state.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (status === "authenticated") setReady(true)
  }, [status])

  if (status === "unauthenticated") redirect("/auth/signin")
  if (!ready && status !== "authenticated") return <div className="h-[100dvh] bg-slate-950" />
  return <OneFlow />
}

export default function DashboardPage() {
  // CheckoutSuccess reads search params, which needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-slate-950" />}>
      <Dashboard />
    </Suspense>
  )
}
