import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { InfoPage, Section } from "@/components/site/info-page"
import { Button } from "@/components/ui/button"
import { AUDIENCES, audienceBySlug } from "@/lib/audiences"
import { OG_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/site"

export const dynamicParams = false
export const generateStaticParams = () => AUDIENCES.map((a) => ({ slug: a.slug }))

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = audienceBySlug((await params).slug)
  if (!a) return {}
  const url = `/for/${a.slug}`
  return {
    title: a.title,
    description: a.description,
    alternates: { canonical: url },
    openGraph: { ...OG_DEFAULTS, title: `${a.title} | ReWork`, description: a.description, url },
    twitter: { ...TWITTER_DEFAULTS, title: `${a.title} | ReWork`, description: a.description },
  }
}

export default async function AudiencePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = audienceBySlug((await params).slug)
  if (!a) notFound()
  const others = AUDIENCES.filter((o) => o.slug !== a.slug)
  return (
    <InfoPage eyebrow={`For ${a.label.toLowerCase()}`} title={a.title} intro={a.intro} faqs={a.faqs} note="Examples are illustrations. Every number in a tailored line is already in the original.">
      <Section title="What's hard, and what ReWork does">
        <ul className="space-y-3">
          {a.hard.map((h) => (
            <li key={h.pain} className="rounded-card bg-surface p-4">
              <p className="font-semibold text-text">{h.pain}</p>
              <p className="mt-1 text-sm">{h.answer}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Example: tailored for a ${a.example.job}`}>
        <div className="overflow-hidden rounded-card bg-surface text-sm">
          <div className="border-b border-border p-4">
            <p className="text-xs font-semibold text-text-muted">Your resume</p>
            <p className="mt-1">{a.example.before}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold text-text-muted">Tailored</p>
            <p className="mt-1 text-text">{a.example.after}</p>
            <p className="mt-1 text-xs text-success">Why: {a.example.why}</p>
          </div>
        </div>
      </Section>

      <div className="rounded-card border border-border bg-surface p-5">
        <p className="font-semibold text-text">See the jobs your resume fits</p>
        <p className="mt-1 text-sm text-text-secondary">Upload it once. ReWork ranks open jobs by your real match, then tailors your resume to the ones you pick. Free to start, no card.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/auth/signin">Find jobs that fit, free</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/fit">Check one job, no sign-up</Link>
          </Button>
        </div>
      </div>

      {a.more && (
        <Section title="More for you">
          <ul className="space-y-2">
            {a.more.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="inline-flex items-center gap-1.5 font-semibold text-accent-strong hover:underline">
                  {m.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-sm">
        Not you?{" "}
        {others.map((o, i) => (
          <span key={o.slug}>
            {i > 0 && " · "}
            <Link href={`/for/${o.slug}`} className="text-text underline underline-offset-4 hover:text-accent-strong">
              {o.label}
            </Link>
          </span>
        ))}
      </p>
    </InfoPage>
  )
}
