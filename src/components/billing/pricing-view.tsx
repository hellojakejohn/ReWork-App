"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { CheckCircle } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { FREE_FEATURES, POWERED_BY, PRICING } from "@/lib/plans"
import { NO_ACCESS } from "@/lib/entitlement-rules"
import { AccessSummary, OfferCards } from "@/components/billing/offer-cards"
import { SiteFooter } from "@/components/site/site-footer"

export function PricingView({ poweredBy }: { poweredBy: boolean }) {
  const { data: session, status } = useSession()
  const access = session ? session.user.access ?? NO_ACCESS : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-black text-white">
      <header className="border-b border-white/10 backdrop-blur-xl bg-slate-900/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={session ? "/dashboard" : "/"} className="flex items-center space-x-2">
            <Logo size="xs" variant="simple" showBadge={false} />
            <span className="text-xl font-bold">ReWork</span>
          </Link>
          {session ? (
            <Link href="/dashboard" className="text-sm text-slate-300 hover:text-white">Back to dashboard</Link>
          ) : (
            <Link href="/auth/signin?callbackUrl=/pricing" className="text-sm text-slate-300 hover:text-white">Sign in</Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 max-w-5xl">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">Pricing</h1>
        <p className="text-lg text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Start free. For a job search, get the {PRICING.pass.name}: {PRICING.pass.headline} {PRICING.pass.amount}, cheaper than two
          months of {PRICING.monthly.name} ({PRICING.monthly.display}).
        </p>
        {poweredBy && <p className="-mt-8 mb-12 text-center text-xs text-slate-400">{POWERED_BY.copy}</p>}

        {access && status === "authenticated" && (
          <div className="max-w-xl mx-auto mb-10">
            <AccessSummary access={access} returnTo="/pricing" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          <div className="flex flex-col rounded-lg border border-white/10 bg-slate-800/40 p-5">
            <span className="font-semibold text-white mb-2">Free</span>
            <div className="text-2xl font-bold text-white">
              $0<span className="text-sm font-normal text-slate-400 ml-1">/month</span>
            </div>
            <ul className="space-y-2 mt-4">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {!session && (
              <div className="mt-auto pt-4">
                <Link href="/auth/signin" className="block">
                  <Button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20">Get started free</Button>
                </Link>
              </div>
            )}
          </div>

          <OfferCards access={status === "loading" ? NO_ACCESS : access} returnTo="/pricing" />
        </div>
        <p className="mt-10 text-center text-sm text-slate-400">
          Cancel {PRICING.monthly.name} anytime from the billing portal. Refunds within 7 days on request, except a {PRICING.pass.name} you&apos;ve
          already used. <Link href="/terms" className="underline hover:text-white">Terms</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
