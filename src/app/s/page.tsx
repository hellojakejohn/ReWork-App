// A shared card (src/lib/share.ts): the image people see in the link preview, and a page
// that invites them to measure or tailor their own. Numbers only, nothing personal.
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { Button } from "@/components/ui/button"
import { OG_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/site"
import { parseShare, shareHeadline, shareImagePath, shareText } from "@/lib/share"

type Search = Promise<Record<string, string | string[] | undefined>>

function cardFrom(search: Record<string, string | string[] | undefined>) {
  return parseShare({ get: (name: string) => (typeof search[name] === "string" ? (search[name] as string) : null) })
}

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const card = cardFrom(await searchParams)
  if (!card) return { title: "ReWork", robots: { index: false } }
  const title = shareHeadline(card)
  const description = shareText(card)
  const image = { url: shareImagePath(card), width: 1200, height: 630, alt: shareHeadline(card) }
  return {
    title: { absolute: `${title} ReWork` },
    description,
    robots: { index: false, follow: true },
    openGraph: { ...OG_DEFAULTS, title, description, images: [image] },
    twitter: { ...TWITTER_DEFAULTS, title, description, images: [image.url] },
  }
}

export default async function SharedCard({ searchParams }: { searchParams: Search }) {
  const card = cardFrom(await searchParams)
  return (
    <div className="min-h-screen bg-bg text-text">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        {card ? (
          <>
            <p className="text-sm font-semibold text-text-muted">Someone shared their measurements</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shareImagePath(card)} alt={shareHeadline(card)} width={1200} height={630} className="mt-4 w-full rounded-panel shadow-float" />
          </>
        ) : (
          <h1 className="font-serif text-4xl font-medium text-text">That share link is incomplete.</h1>
        )}
        <h2 className="mt-10 font-serif text-3xl font-medium text-text">Now yours.</h2>
        <p className="mt-2 text-lg text-text-secondary">
          See how well your resume fits a job in seconds, free and without signing up. Then have it tailored, from your real experience only.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/fit">
              Take my measurements <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/">How ReWork works</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
