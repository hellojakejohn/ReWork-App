// Public fit check: "Take your measurements". No account, nothing saved.
// The form and result are a client component (src/components/site/fit-check.tsx).
import type { Metadata } from "next"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { FitCheck } from "@/components/site/fit-check"
import { OG_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/site"

const TITLE = "Take your measurements: how well does your resume fit this job?"
const DESCRIPTION =
  "Paste a job post, add your resume, and see your fit in seconds: the skills you match, the ones you have in other words, and what's missing. Free, no sign-up, nothing saved."

export const metadata: Metadata = {
  title: "Free resume fit check",
  description: DESCRIPTION,
  alternates: { canonical: "/fit" },
  openGraph: { ...OG_DEFAULTS, title: TITLE, description: DESCRIPTION, url: "/fit" },
  twitter: { ...TWITTER_DEFAULTS, title: TITLE, description: DESCRIPTION },
}

export default function FitPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <div className="max-w-2xl">
          <span className="rounded-full bg-sage px-3.5 py-2 text-sm font-semibold text-text">Free. No sign-up. Nothing saved.</span>
          <h1 className="mt-6 font-serif text-5xl font-medium leading-[1.05] tracking-tight text-text sm:text-6xl">Take your measurements</h1>
          <p className="mt-5 text-lg leading-relaxed text-text-secondary">
            Before you apply, see how well your resume fits the job: what fits already, what you have in other words, and what needs
            alterations.
          </p>
        </div>
        <FitCheck />
      </main>
      <SiteFooter />
    </div>
  )
}
