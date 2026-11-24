// Shared bits for the public explainer pages (/visa-sponsorship-jobs, /opt-unemployment-days):
// plain sections, a FAQ with FAQPage JSON-LD, and the sign-up call to action.
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"

export interface Faq {
  q: string
  a: string
}

export function InfoPage({ eyebrow, title, intro, faqs, children, note }: { eyebrow: string; title: string; intro: string; faqs: Faq[]; children: ReactNode; note: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }
  return (
    <div className="min-h-screen bg-bg text-text">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight text-text sm:text-5xl">{title}</h1>
        <p className="mt-4 text-lg text-text-secondary">{intro}</p>
        <div className="mt-10 space-y-10">{children}</div>
        <section className="mt-12">
          <h2 className="font-serif text-2xl font-medium text-text">Short answers</h2>
          <div className="mt-4 divide-y divide-border rounded-card border border-border bg-surface">
            {faqs.map((f) => (
              <details key={f.q} className="group p-4">
                <summary className="cursor-pointer font-semibold text-text">{f.q}</summary>
                <p className="mt-2 text-sm text-text-secondary">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <p className="mt-10 text-xs text-text-muted">{note}</p>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl font-medium text-text">{title}</h2>
      <div className="mt-3 space-y-3 text-text-secondary">{children}</div>
    </section>
  )
}

export function Src({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-text underline underline-offset-4 hover:text-accent-strong">
      {children}
    </a>
  )
}

/** The way in: free fit check now, matches with sponsorship signals after sign-in. */
export function VisaCta() {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <p className="font-semibold text-text">See which of your matches could sponsor you</p>
      <p className="mt-1 text-sm text-text-secondary">
        Upload your resume and ReWork shows the open jobs that fit it. Turn on &ldquo;I&apos;ll need visa sponsorship&rdquo; in Settings and each match shows what the post says about sponsorship and the employer&apos;s H-1B record. Free.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/dashboard">Find my matches</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/fit">Check one job free</Link>
        </Button>
      </div>
    </div>
  )
}
