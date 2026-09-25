"use client"

import { Suspense } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { OneFlow } from "@/components/flow/one-flow"

function Dashboard() {
  const { status } = useSession()
  if (status === "unauthenticated") redirect("/auth/signin")
  if (status === "loading") return <div className="h-[100dvh] bg-slate-950" />
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
