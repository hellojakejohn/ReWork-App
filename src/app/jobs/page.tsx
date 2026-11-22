import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getRoleIndex } from "@/lib/role-pages-server"
import { OG_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/site"

export const dynamic = "force-dynamic"

const DESCRIPTION = "Open jobs by role, straight from employers' own job boards and updated every morning: how many, typical pay, remote share and who's hiring."

export const metadata: Metadata = {
  title: "Jobs by role",
  description: DESCRIPTION,
  alternates: { canonical: "/jobs" },
  openGraph: { ...OG_DEFAULTS, title: "Jobs by role | ReWork", description: DESCRIPTION, url: "/jobs" },
  twitter: { ...TWITTER_DEFAULTS, title: "Jobs by role | ReWork", description: DESCRIPTION },
}

export default async function JobsIndex() {
  const roles = await getRoleIndex()
  return (
    <div className="min-h-screen bg-bg text-text">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-text sm:text-5xl">Jobs by role</h1>
        <p className="mt-4 text-lg text-text-secondary">{DESCRIPTION}</p>
        {roles.length === 0 ? (
          <p className="mt-10 text-text-muted">The job list is refreshing. Check back in a few minutes.</p>
        ) : (
          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {roles.map((r) => (
              <li key={r.slug}>
                <Link href={`/jobs/${r.slug}`} className="flex items-center justify-between rounded-card border border-border bg-surface p-4 hover:border-text">
                  <span className="font-semibold text-text">{r.title}</span>
                  <span className="text-sm text-text-muted">{r.count.toLocaleString("en-US")} open</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
