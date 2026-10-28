import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { burnConfig } from "@/lib/token-burn"
import { BURN_PRO_DAYS, BURN_PRO_USD } from "@/lib/plans"

// /token: the one place the token lives (docs/token-plan.md). 404 until REWORK_MINT is set.
// Copy follows the phrasing rules: what the token does, never where its price goes.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "$REWORK",
  description: "rework's memecoin, and how to burn it for Pro.",
  alternates: { canonical: "/token" },
}

export default function TokenPage() {
  const config = burnConfig()
  if (!config) notFound()
  const { mint } = config

  return (
    <div className="min-h-screen bg-bg text-text-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-text sm:text-5xl">$REWORK</h1>
        <p className="mt-4 max-w-2xl leading-relaxed">
          rework&apos;s memecoin on Solana. It&apos;s a collectible, not an investment: it has no promised value, rework never buys it back, and
          nobody at rework holds any.
        </p>

        <section className="mt-8 rounded-card bg-surface p-6">
          <h2 className="font-serif text-2xl font-semibold text-text">Burn for Pro</h2>
          <p className="mt-2 leading-relaxed">
            Burn ${BURN_PRO_USD} worth of $REWORK and get {BURN_PRO_DAYS} days of rework Pro, the same Pro a card buys. The tokens are destroyed
            on-chain and nobody receives them. Burns are final.
          </p>
          <Link
            href="/dashboard/token"
            className="mt-5 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg hover:bg-accent-hover"
          >
            Burn for Pro
          </Link>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="font-serif text-2xl font-semibold text-text">Contract address</h2>
          <p className="break-all rounded-input bg-surface px-3 py-2 font-mono text-sm text-text">{mint}</p>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <a className="underline underline-offset-4 hover:text-text" href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer">
              Solscan
            </a>
            <a className="underline underline-offset-4 hover:text-text" href={`https://dexscreener.com/solana/${mint}`} target="_blank" rel="noreferrer">
              DexScreener
            </a>
          </p>
          <p className="text-sm leading-relaxed">
            Check the address before you buy anything. Copies with the same name are common. This page is the source.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="font-serif text-2xl font-semibold text-text">How rework earns from it</h2>
          <p className="leading-relaxed">
            The launchpad pays rework a 1% creator fee on trading volume. That&apos;s rework&apos;s revenue, the same as a sale, and it pays for
            servers and AI.
          </p>
        </section>

        <p className="mt-10 text-xs leading-relaxed text-text-muted">
          Nothing here is financial advice. Crypto is risky, so only use money you can afford to lose. rework Pro bought with a card works the
          same and never needs a wallet.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
