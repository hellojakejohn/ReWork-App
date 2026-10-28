"use client"

import { useState } from "react"
import { Check, Crown, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { OFFER_IDS, PRICING, PRO_FEATURES, type OfferId } from "@/lib/plans"
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
      label: onPass ? `Add 3 more months (${PRICING.pass.amount})` : `Get 3 months for ${PRICING.pass.amount}`,
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
        const featured = id === "pass"
        const busy = pending === id || (id === "monthly" && pending === "portal")
        return (
          <div
            key={id}
            className={cn(
              "flex flex-col rounded-card",
              compact ? "p-5" : "p-6 sm:p-7",
              featured ? "bg-inverse text-inverse-fg" : "bg-surface text-text",
              compact && !featured && "border border-border"
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 opacity-80" aria-hidden />
              <h3 className={cn("text-sm font-bold", !featured && "text-text-muted")}>
                {offer.name}
                {featured && " · most popular"}
              </h3>
            </div>
            <p className={cn("mt-2 font-serif", compact ? "text-3xl" : "text-4xl")}>
              {offer.amount} <span className={cn("text-lg", featured ? "opacity-80" : "text-text-muted")}>{offer.id === "pass" ? "once" : "/ month"}</span>
            </p>
            {offer.headline && <p className="mt-2 text-sm font-semibold">{offer.headline}</p>}
            <p className={cn("mt-1 text-xs", featured ? "opacity-80" : "text-text-muted")}>{offer.cadence}</p>
            <p className={cn("mt-3 text-sm", featured ? "opacity-90" : "text-text-secondary")}>{offer.blurb}</p>
            {!compact && (
              <ul className="mt-5 space-y-2.5">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className={cn("flex items-start gap-2 text-sm", featured ? "opacity-90" : "text-text-secondary")}>
                    <Check className={cn("mt-0.5 h-4 w-4 flex-shrink-0", !featured && "text-success")} aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto pt-6">
              <Button
                onClick={a.onClick}
                disabled={a.disabled || pending !== null}
                loading={busy}
                variant={featured ? "primary" : "secondary"}
                className="w-full"
              >
                {!busy && a.label}
              </Button>
              {a.note && <p className={cn("mt-2 text-xs", featured ? "opacity-80" : "text-text-muted")}>{a.note}</p>}
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
      className={cn("rounded-card p-4", access.pastDue ? "bg-warn-tint" : access.isPro ? "bg-success-tint" : "bg-surface-raised")}
    >
      <div className="flex items-center gap-2">
        {access.isPro && <Crown className="h-4 w-4 text-success" aria-hidden />}
        <span className={cn("font-semibold", access.pastDue ? "text-warn" : "text-text")}>
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
          variant="secondary"
          size="sm"
          className="mt-3"
        >
          {opening ? "Opening..." : access.pastDue ? "Update payment method" : "Manage subscription"}
        </Button>
      )}
    </div>
  )
}
