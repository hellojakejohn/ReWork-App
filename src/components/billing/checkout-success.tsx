"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import { describeAccess, type Access } from "@/lib/entitlement-rules"

const POLL_MS = 1000
const MAX_WAIT_MS = 10_000

/**
 * Handles /dashboard?checkout=success&offer=... The webhook may land a few seconds after
 * Stripe redirects back, so poll access until Pro shows up (or give up after ~10s).
 */
export function CheckoutSuccess() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { update } = useSession()
  const started = useRef(false)

  useEffect(() => {
    if (searchParams.get("checkout") !== "success" || started.current) return
    started.current = true
    let cancelled = false
    const toastId = toast.loading("Confirming your payment...")

    const clearParams = () => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("checkout")
      params.delete("offer")
      const qs = params.toString()
      router.replace(qs ? `/dashboard?${qs}` : "/dashboard")
    }

    const poll = async () => {
      const deadline = Date.now() + MAX_WAIT_MS
      while (!cancelled && Date.now() < deadline) {
        try {
          const res = await fetch("/api/billing/access", { cache: "no-store" })
          if (res.ok) {
            const { access } = (await res.json()) as { access: Access }
            if (access.isPro) {
              await update()
              toast.success(`You're Pro. ${describeAccess(access)}.`, { id: toastId })
              confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } })
              clearParams()
              return
            }
          }
        } catch {
          // keep polling
        }
        await new Promise((r) => setTimeout(r, POLL_MS))
      }
      if (!cancelled) {
        toast.info("Payment received. Pro should unlock within a minute; refresh if it hasn't.", {
          id: toastId,
          duration: 10000,
        })
        clearParams()
      }
    }
    void poll()
    return () => {
      cancelled = true
    }
  }, [searchParams, router, update])

  return null
}
