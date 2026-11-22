// Public role page: live numbers for one kind of job, from employers' own boards.
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ExternalLink, Ruler } from "lucide-react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { Button } from "@/components/ui/button"
import { getRolePage } from "@/lib/role-pages-server"
import { money, roleBySlug } from "@/lib/role-pages"
import { OG_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/site"
import { FREE_TAILORS_PER_MONTH } from "@/lib/plans"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ role: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const role = roleBySlug((await params).role)
  if (!role) return {}
  const data = await getRolePage(role.slug)
  const n = data?.summary.count
  const title = `${role.title} jobs${n ? `: ${n.toLocaleString("en-US")} open now` : ""}`
  const description = `${n ? `${n.toLocaleString("en-US")} open ${role.title} jobs` : `Open ${role.title} jobs`} from employers' own job boards, updated every morning. Typical pay, remote share, who's hiring, and a free check of how your resume fits.`
  return {
    title,
    description,
    alternates: { canonical: `/jobs/${role.slug}` },
    openGraph: { ...OG_DEFAULTS, title, description, url: `/jobs/${role.slug}` },
    twitter: { ...TWITTER_DEFAULTS, title, description },
  }
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const asDate = (d: Date | string | null) => (d ? new Date(d) : null)

function ago(d: Date | null): string {
  if (!d) return ""
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 60) return `${days} days ago`
  return `about ${Math.round(days / 30)} months ago`
}

export default async function RolePage({ params }: Params) {
  const { role: slug } = await params
  const data = await getRolePage(slug)
  if (!data) notFound()
  const { role, summary: s } = data
  const pay = s.yearly ? `${money(s.yearly.low, "year")} to ${money(s.yearly.high, "year")} a year` : s.hourly ? `${money(s.hourly.low, "hour")} to ${money(s.hourly.high, "hour")} an hour` : null
  const payNote = s.yearly ? `median of ${s.yearly.n} posts that list pay` : s.hourly ? `median of ${s.hourly.n} posts that list pay` : ""

  return (
    <div className="min-h-screen bg-bg text-text">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <nav className="text-sm text-text-muted" aria-label="Breadcrumb">
          <Link href="/jobs" className="hover:text-text hover:underline">Jobs</Link> / {role.title}
        </nav>
        <h1 className="mt-4 font-serif text-4xl font-medium leading-tight tracking-tight text-text sm:text-5xl">{role.title} jobs</h1>
        <p className="mt-4 text-lg leading-relaxed text-text-secondary">
          {s.count.toLocaleString("en-US")} open now, straight from employers&apos; own job boards and checked every morning. {role.intro}
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-card bg-surface p-4">
            <dt className="text-xs text-text-muted">Open jobs</dt>
            <dd className="mt-1 font-serif text-3xl text-text">{s.count.toLocaleString("en-US")}</dd>
          </div>
          <div className="rounded-card bg-surface p-4">
            <dt className="text-xs text-text-muted">Employers</dt>
            <dd className="mt-1 font-serif text-3xl text-text">{s.employers.toLocaleString("en-US")}</dd>
            <dd className="mt-1 text-xs text-text-muted">{pct(s.remoteShare)} remote</dd>
          </div>
          <div className="col-span-2 rounded-card bg-surface p-4">
            <dt className="text-xs text-text-muted">Typical pay{payNote ? ` (${payNote})` : ""}</dt>
            <dd className="mt-1 font-serif text-2xl text-text">{pay ?? "Not enough posts list pay"}</dd>
            <dd className="mt-1 text-xs text-text-muted">{pct(s.payShare)} of these posts list pay.</dd>
          </div>
        </dl>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {s.topCompanies.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-semibold text-text">Who&apos;s hiring</h2>
              <ul className="mt-3 space-y-1 text-text-secondary">
                {s.topCompanies.map((c) => (
                  <li key={c.company} className="flex justify-between gap-4">
                    <span>{c.company}</span>
                    <span className="text-text-muted">{c.n}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {s.topStates.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-semibold text-text">Where</h2>
              <ul className="mt-3 space-y-1 text-text-secondary">
                {s.topStates.map((st) => (
                  <li key={st.state} className="flex justify-between gap-4">
                    <span>{st.state}</span>
                    <span className="text-text-muted">{st.n}</span>
                  </li>
                ))}
                {s.remoteShare > 0 && (
                  <li className="flex justify-between gap-4">
                    <span>Remote</span>
                    <span className="text-text-muted">{Math.round(s.remoteShare * s.count)}</span>
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>

        {s.topSkills.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl font-semibold text-text">Skills these posts ask for</h2>
            <p className="mt-1 text-sm text-text-muted">Share of {s.skillJobs.toLocaleString("en-US")} {role.title} posts that ask for each one.</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {s.topSkills.map((k) => (
                <li key={k.skill} className="rounded-full bg-surface px-3 py-1.5 text-sm text-text">
                  {k.skill} <span className="text-text-muted">{pct(k.share)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10 flex flex-col gap-4 rounded-card bg-inverse p-6 text-inverse-fg sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-2xl font-semibold">Which of these fit you?</p>
            <p className="mt-1 text-sm opacity-80">Upload your resume once and ReWork ranks every open job by how well you match. {FREE_TAILORS_PER_MONTH} free tailored resumes a month, no card.</p>
          </div>
          <Button asChild size="lg" variant="secondary" className="shrink-0">
            <Link href="/auth/signin?callbackUrl=%2Fdashboard">
              See my matches <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <section className="mt-10">
          <h2 className="font-serif text-2xl font-semibold text-text">Newest {role.title} jobs</h2>
          <p className="mt-1 text-sm text-text-muted">Up to 3 per employer, so you see who else is hiring.</p>
          <ul className="mt-4 divide-y divide-border rounded-card border border-border bg-surface">
            {s.newest.map((j) => (
              <li key={j.url} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-text">{j.title}</p>
                  <p className="text-sm text-text-muted">
                    {[j.company, j.remote && !/remote/i.test(j.location) ? `${j.location}, Remote` : j.location, j.payLabel].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-text-faint">Posted {ago(asDate(j.postedAt) ?? asDate(j.firstSeenAt))}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
                  <Link href={`/fit?job=${encodeURIComponent(j.id)}`} rel="nofollow" className="inline-flex items-center gap-1 text-sm font-medium text-text hover:underline">
                    <Ruler className="h-3.5 w-3.5" /> Check my fit
                  </Link>
                  <a href={j.url} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-sm font-medium text-accent-strong hover:underline">
                    View on their site <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-text-muted">
            Found one? <Link href="/check" className="underline">Check it&apos;s still real</Link> and <Link href="/fit" className="underline">see how your resume fits</Link>, both free.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
