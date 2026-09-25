import type { ReactNode } from "react"
import { SiteHeader } from "./site-header"
import { SiteFooter } from "./site-footer"

// Change this when either policy changes.
export const LEGAL_LAST_UPDATED = "September 25, 2026"

export function LegalPage({ title, summary, children }: { title: string; summary: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated {LEGAL_LAST_UPDATED}</p>

        <aside className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5" aria-label="Plain-language summary">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Plain-language summary, not legal advice</p>
          <div className="mt-3 text-sm leading-relaxed text-slate-200">{summary}</div>
          <p className="mt-3 text-xs text-slate-400">The full text below is what applies. If the summary and the full text disagree, the full text wins.</p>
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
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {children}
    </section>
  )
}
