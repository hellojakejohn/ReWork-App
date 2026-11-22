"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { celebrate } from "@/components/ui/celebrate"
import { CheckCircle, Crown } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Access } from "@/lib/entitlement-rules"
import { PRO_WELCOME_HIGHLIGHTS, proWelcome } from "@/lib/pro-welcome"

const POLL_MS = 1000
const MAX_WAIT_MS = 10_000

/**
 * Handles /dashboard?checkout=success&offer=... The webhook may land a few seconds after
 * Stripe redirects back, so poll access until Pro shows up (or give up after ~10s), then
 * show the "You're Pro" popup.
 */
export function CheckoutSuccess({ onSeeMatches }: { onSeeMatches?: () => void }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, update } = useSession()
  const started = useRef(false)
  const [welcome, setWelcome] = useState<Access | null>(null)

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
              toast.dismiss(toastId)
              setWelcome(access)
              celebrate()
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

  if (!welcome) return null
  return (
    <ProWelcomeDialog
      access={welcome}
      name={session?.user?.name}
      onClose={() => setWelcome(null)}
      onSeeMatches={onSeeMatches}
    />
  )
}

/** The "You're Pro" popup: what they bought, what's unlocked, and where to go next. */
export function ProWelcomeDialog({
  access,
  name,
  onClose,
  onSeeMatches,
}: {
  access: Access
  name?: string | null
  onClose: () => void
  onSeeMatches?: () => void
}) {
  const { title, detail } = proWelcome(access, name)
  const close = onClose
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader className="items-center text-center sm:text-center">
          <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Crown className="h-6 w-6" />
          </span>
          <DialogTitle className="font-serif text-3xl font-medium tracking-tight text-text">{title}</DialogTitle>
          <DialogDescription className="text-text-secondary">{detail}</DialogDescription>
        </DialogHeader>
        <div className="rounded-card border border-border p-4">
          <p className="text-sm font-semibold text-text">Unlocked now</p>
          <ul className="mt-2 space-y-2">
            {PRO_WELCOME_HIGHLIGHTS.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          {onSeeMatches && (
            <Button
              onClick={() => {
                close()
                onSeeMatches()
              }}
            >
              See all my matches
            </Button>
          )}
          <Button variant={onSeeMatches ? "text" : "primary"} onClick={close}>
            {onSeeMatches ? "Later" : "Let's go"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
