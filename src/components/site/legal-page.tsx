import type { ReactNode } from "react"
import { SiteHeader } from "./site-header"
import { SiteFooter } from "./site-footer"

// Change this when either policy changes.
export const LEGAL_LAST_UPDATED = "September 25, 2026"

export function LegalPage({ title, summary, children }: { title: string; summary: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-text sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-text-muted">Last updated {LEGAL_LAST_UPDATED}</p>

        <aside className="mt-8 rounded-card bg-surface p-6" aria-label="Plain-language summary">
          <p className="inline-block rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold text-text">Plain-language summary, not legal advice</p>
          <div className="mt-3 text-sm leading-relaxed text-text">{summary}</div>
          <p className="mt-3 text-xs text-text-muted">The full text below is what applies. If the summary and the full text disagree, the full text wins.</p>
        </aside>

        <div className="legal mt-10 space-y-8 leading-relaxed">{children}</div>
      </main>
      <SiteFooter />
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-2xl font-semibold text-text">{title}</h2>
      {children}
    </section>
  )
}
