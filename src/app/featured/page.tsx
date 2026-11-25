import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"

// /featured: directories that list ReWork. Several only approve a listing once their badge
// link is on our site, so each badge keeps their link and hosted image exactly as given.
// The footer links here as plain text, so the badges stay off every other page.
export const metadata: Metadata = {
  title: "As seen on",
  description: "Directories and sites where ReWork is listed.",
  alternates: { canonical: "/featured" },
}

type Listing = {
  name: string
  href: string
  alt: string
  width: number
  height: number
  // Their light and dark badge images; we show the one that matches the theme.
  light: string
  dark: string
}

const LISTINGS: Listing[] = [
  {
    name: "PostYourStartup",
    href: "https://postyourstartup.com/startup/rework?ref=badge",
    alt: "Featured on PostYourStartup",
    width: 212,
    height: 55,
    light: "https://postyourstartup.com/api/badge/rework?theme=light",
    dark: "https://postyourstartup.com/api/badge/rework?theme=dark",
  },
]

export default function FeaturedPage() {
  return (
    <div className="min-h-screen bg-bg text-text-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-text sm:text-5xl">As seen on</h1>
        <p className="mt-3 leading-relaxed">
          Places that list ReWork. New here?{" "}
          <Link href="/" className="underline underline-offset-4 hover:text-text">
            See how it works
          </Link>
          .
        </p>
        <ul className="mt-10 flex flex-wrap items-center gap-6">
          {LISTINGS.map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noopener" aria-label={l.name}>
                {/* Their hosted badges, as given: the directory checks for them. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.light} alt={l.alt} width={l.width} height={l.height} className="dark:hidden" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.dark} alt={l.alt} width={l.width} height={l.height} className="hidden dark:block" />
              </a>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  )
}
