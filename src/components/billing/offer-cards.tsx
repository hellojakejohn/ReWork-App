"use client"

import { useState } from "react"
import { CheckCircle, Crown, Loader2, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OFFER_IDS, PASS_DAYS, PRICING, PRO_FEATURES, type OfferId } from "@/lib/plans"
import { describeAccess, type Access } from "@/lib/entitlement-rules"
import { openPortal, startCheckout } from "@/lib/billing-client"

interface OfferCardsProps {
  access: Access | null // null = signed out
  compact?: boolean // hide feature list (upgrade sheet shows it once above)
  returnTo?: string
}

/** The two ways to buy Pro, with buttons that reflect what the user already has. */
export function OfferCards({ access, compact = false, returnTo }: OfferCardsProps) {
  const [pending, setPending] = useState<OfferId | 'portal' | null>(null)
  const subscribed = access?.source === "STRIPE_SUBSCRIPTION"
  const onPass = access?.source === "STRIPE_PASS"

  const run = async (key: OfferId | 'portal', fn: () => Promise<void>) => {
    setPending(key)
    try {
      await fn()
    } finally {
      setPending(null)
    }
  }

  const action = (id: OfferId): { label: string; onClick?: () => void; disabled?: boolean; note?: string } => {
    if (!access) {
      return {
        label: id === "monthly" ? "Sign in to subscribe" : "Sign in to buy a pass",
        onClick: () => {
          window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(returnTo || "/pricing")}`
        },
      }
    }
    if (id === "monthly") {
      if (subscribed) return { label: "Manage subscription", onClick: () => run("portal", () => openPortal(returnTo)) }
      return {
        label: `Subscribe for ${PRICING.monthly.display}`,
        onClick: () => run("monthly", () => startCheckout("monthly", returnTo)),
        note: onPass ? "Your pass days keep running alongside the subscription." : undefined,
      }
    }
    if (subscribed) return { label: "Included in your subscription", disabled: true }
    return {
      label: onPass ? `Add ${PASS_DAYS} more days (${PRICING.pass.amount})` : `Buy pass for ${PRICING.pass.amount}`,
      onClick: () => run("pass", () => startCheckout("pass", returnTo)),
      note: onPass ? `Stacks onto your current pass: ${describeAccess(access)}.` : undefined,
    }
  }

  return (
    <div className={`grid grid-cols-1 ${compact ? "sm:grid-cols-2 gap-3" : "md:grid-cols-2 gap-6"}`}>
      {OFFER_IDS.map((id) => {
        const offer = PRICING[id]
        const a = action(id)
        const Icon = id === "monthly" ? Crown : Ticket
        const busy = pending === id || (id === "monthly" && pending === "portal")
        return (
          <div
            key={id}
            className={`flex flex-col rounded-lg border p-5 ${
              id === "monthly" ? "border-emerald-500/40 bg-emerald-900/10" : "border-white/10 bg-slate-800/40"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-white">{offer.name}</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {offer.amount}
              <span className="text-sm font-normal text-slate-400 ml-1">{offer.period}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{offer.cadence}</p>
            <p className="text-sm text-slate-300 mt-3">{offer.blurb}</p>
            {!compact && (
              <ul className="space-y-2 mt-4">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto pt-4">
              <Button
                onClick={a.onClick}
                disabled={a.disabled || pending !== null}
                className={`w-full ${
                  id === "monthly"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                }`}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : a.label}
              </Button>
              {a.note && <p className="text-xs text-slate-400 mt-2">{a.note}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** "Pro via monthly, renews Oct 25" plus a portal button for subscribers. */
export function AccessSummary({ access, returnTo }: { access: Access; returnTo?: string }) {
  const [opening, setOpening] = useState(false)
  return (
    <div
      className={`p-4 rounded-lg border ${
        access.pastDue
          ? "border-amber-500/40 bg-amber-900/20"
          : access.isPro
            ? "border-emerald-500/30 bg-emerald-900/20"
            : "border-white/10 bg-slate-800/30"
      }`}
    >
      <div className="flex items-center gap-2">
        {access.isPro && <Crown className="w-4 h-4 text-emerald-400" />}
        <span className={`font-medium ${access.pastDue ? "text-amber-300" : access.isPro ? "text-emerald-400" : "text-slate-300"}`}>
          {describeAccess(access)}
        </span>
      </div>
      {access.source === "STRIPE_SUBSCRIPTION" && (
        <Button
          onClick={async () => {
            setOpening(true)
            try {
              await openPortal(returnTo)
            } finally {
              setOpening(false)
            }
          }}
          disabled={opening}
          variant="outline"
          size="sm"
          className="mt-3 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
        >
          {opening ? "Opening..." : access.pastDue ? "Update payment method" : "Manage subscription"}
        </Button>
      )}
    </div>
  )
}
