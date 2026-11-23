"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { TrackerView } from "@/components/tracker/tracker-view"

export default function TrackerPage() {
  const { status } = useSession()
  // Same as /dashboard: only the first load shows the placeholder.
  const [ready, setReady] = useState(false)
  if (status === "authenticated" && !ready) setReady(true)

  if (status === "unauthenticated") redirect("/auth/signin")
  if (!ready && status !== "authenticated") return <div className="h-[100dvh] bg-bg" />
  return <TrackerView />
}
