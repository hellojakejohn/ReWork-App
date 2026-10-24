"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FREE_FEATURES, POWERED_BY, PRICING } from "@/lib/plans"
import { NO_ACCESS } from "@/lib/entitlement-rules"
import { AccessSummary, OfferCards } from "@/components/billing/offer-cards"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"

export function PricingView({ poweredBy }: { poweredBy: boolean }) {
  const { data: session, status } = useSession()
  const access = session ? session.user.access ?? NO_ACCESS : null

  return (
    <div className="min-h-screen bg-bg text-text">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <h1 className="font-serif text-5xl font-medium tracking-tight text-text sm:text-6xl">Pricing that fits a job search</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-secondary">
          Start free. For a job search, get the {PRICING.pass.name}: {PRICING.pass.headline} {PRICING.pass.amount}, cheaper than two months of{" "}
          {PRICING.monthly.name} ({PRICING.monthly.display}).
        </p>
        {poweredBy && <p className="mt-3 text-sm text-text-muted">{POWERED_BY.copy}</p>}
        {session && (
          <p className="mt-3 text-sm">
            <Link href="/dashboard" className="font-semibold text-accent-strong underline underline-offset-4 hover:text-text">
              Back to the app
            </Link>
          </p>
        )}

        {access && status === "authenticated" && (
          <div className="mt-10 max-w-xl">
            <AccessSummary access={access} returnTo="/pricing" />
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col rounded-card bg-surface p-6 sm:p-7">
            <h2 className="text-sm font-semibold text-text-muted">Free</h2>
            <p className="mt-2 font-serif text-4xl text-text">
              $0 <span className="text-lg text-text-muted">/ month</span>
            </p>
            <ul className="mt-5 space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {!session && (
              <div className="mt-auto pt-6">
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/auth/signin">Get started free</Link>
                </Button>
              </div>
            )}
          </div>

          <OfferCards access={status === "loading" ? NO_ACCESS : access} returnTo="/pricing" />
        </div>
        <p className="mt-10 text-sm text-text-muted">
          Cancel {PRICING.monthly.name} anytime from the billing portal. Refunds within 7 days on request, except a {PRICING.pass.name} you&apos;ve
          already used.{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-text">
            Terms
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
