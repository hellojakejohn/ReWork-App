// Landing page. A server component on purpose: no animation libraries, no client JS of
// its own (except the one-line "account deleted" notice), so it paints fast on mobile.
// Every number comes from src/lib/plans.ts.
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, ShieldCheck, X } from "lucide-react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { DeletedNotice } from "@/components/site/deleted-notice"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { LANDING_EXAMPLE as EX } from "@/components/site/landing-example"
import { OG_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/site"
import { CONTACT_EMAIL, FAIR_USE, FREE_PLAN_SHORT, FREE_TAILORS_PER_MONTH, POWERED_BY, PRICING } from "@/lib/plans"
import { showPoweredBy } from "@/lib/ai/routing"

const TITLE = "rework: Tailored to the job. True to you."
const DESCRIPTION = `Upload your resume, paste a job link, get a tailored resume and cover letter. Every rewrite is fact-checked against your real resume. ${FREE_TAILORS_PER_MONTH} free tailors a month, no card.`

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { ...OG_DEFAULTS, title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { ...TWITTER_DEFAULTS, title: TITLE, description: DESCRIPTION },
}

const STEPS = [
  {
    title: "Upload your resume",
    body: "PDF, Word, or pasted text. What's in it is the only thing we work from.",
  },
  {
    title: "Paste the job link",
    body: "Most job boards fill in automatically. Or just paste the description.",
  },
  {
    title: "Fill the gaps with real numbers",
    body: "When a rewrite needs a number your resume doesn't have, we leave it out and ask you for the real one. No guesses.",
  },
]

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is anything made up?",
    a: (
      <>
        No. After every rewrite a fact guard compares the result with your resume: numbers, employers, titles, dates, tools and credentials. Anything
        your resume doesn’t support is removed or flagged, and every changed bullet comes with the reason for the change so you can keep it or
        revert it. When a bullet needs a number, the evidence interview asks you for it instead of guessing.
      </>
    ),
  },
  {
    q: "Does it work with applicant tracking systems (ATS)?",
    a: (
      <>
        The templates are single-column with standard section headings, and PDFs contain real, selectable text. Pro adds Word downloads built from
        plain paragraphs, with no tables or text boxes, which is what application portals parse most reliably. We don’t promise an &quot;ATS
        score&quot;; nobody honestly can.
      </>
    ),
  },
  {
    q: "What happens to my data?",
    a: (
      <>
        Your resumes and results are stored in our database so they&apos;re there when you come back. Resume and job text is sent to Anthropic&apos;s
        paid Claude API to do the rewriting, and Anthropic doesn&apos;t use it to train its models. We never sell it or share it with employers.
        You can download everything or delete your account any time from Settings. Details in the <Link href="/privacy">privacy policy</Link>.
      </>
    ),
  },
  {
    q: "Which job sites work?",
    a: (
      <>
        Links from Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable and most company career pages fill in automatically. We don&apos;t
        read LinkedIn pages, and Indeed, Glassdoor and ZipRecruiter block apps from reading theirs, so for those, copy the job description and
        paste it in.
      </>
    ),
  },
  {
    q: "Can I cancel anytime? What about refunds?",
    a: (
      <>
        Yes. {PRICING.monthly.name} cancels in one click from the billing portal, and you keep Pro until the end of the month you paid for. The{" "}
        {PRICING.pass.name} never renews, so there&apos;s nothing to cancel. Refunds: ask within 7 days of any payment and we&apos;ll refund it, except
        a {PRICING.pass.name} you&apos;ve already used. See the <Link href="/terms">terms</Link> or email {CONTACT_EMAIL}.
      </>
    ),
  },
]

const container = "mx-auto max-w-6xl px-4 sm:px-6"
const h2 = "font-serif text-3xl font-medium tracking-tight text-text sm:text-4xl"
const card = "rounded-card bg-surface p-6 sm:p-7"

export default function HomePage() {
  const poweredBy = showPoweredBy()
  return (
    <div className="min-h-screen bg-bg text-text">
      <DeletedNotice />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className={`${container} grid items-center gap-12 pb-16 pt-8 sm:pb-24 sm:pt-16 lg:grid-cols-2 lg:gap-14`}>
          <div className="flex flex-col items-start gap-6">
            <span className="rounded-full bg-sage px-3.5 py-2 text-sm font-semibold text-text">Nothing made up. Ever.</span>
            <h1 className="font-serif text-5xl font-medium leading-[1.02] tracking-tight text-text sm:text-6xl lg:text-7xl">
              Same you. Better fit.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-text-secondary">
              Job hunting is hard enough. rework tailors your resume to each job, asks you for the real numbers, and never fills a gap with a
              guess.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth/signin">Tailor my resume, free</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="#example">See an example</Link>
              </Button>
            </div>
            <p className="text-sm text-text-muted">{FREE_TAILORS_PER_MONTH} free tailors a month. No card needed.</p>
          </div>
          <HeroReceipt />
        </section>

        {/* How it works */}
        <section id="how-it-works" className={`${container} scroll-mt-8 py-16 sm:py-20`}>
          <h2 className={h2}>Three steps. Honest results.</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className={`${card} flex flex-col gap-2.5`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage font-bold text-text">{i + 1}</span>
                <h3 className="text-xl font-bold text-text">{step.title}</h3>
                <p className="leading-relaxed text-text-secondary">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Before / after */}
        <section id="example" className={`${container} scroll-mt-8 py-16 sm:py-20`}>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className={h2}>What a tailor looks like</h2>
            <span className="rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold text-text">Example</span>
          </div>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-text-secondary">
            {EX.person}, tailored for an {EX.job}. Same facts, pointed at the job. Every number on the right is already in the original resume.
          </p>

          <div className="mt-10 overflow-hidden rounded-panel bg-surface">
            <div className="grid grid-cols-1 border-b border-border text-xs font-semibold text-text-muted md:grid-cols-2">
              <div className="px-6 py-3">Your resume</div>
              <div className="hidden px-6 py-3 md:block">Tailored</div>
            </div>
            {[{ before: EX.summary.before, after: EX.summary.after, why: "Summary leads with what this job needs." }, ...EX.bullets].map((row) => (
              <div key={row.before} className="grid grid-cols-1 border-b border-border last:border-b-0 md:grid-cols-2">
                <p className="px-6 py-4 text-sm leading-relaxed text-text-muted">{row.before}</p>
                <div className="px-6 pb-4 md:py-4">
                  <p className="text-sm leading-relaxed text-text">{row.after}</p>
                  <p className="mt-1 text-xs text-success">Why: {row.why}</p>
                </div>
              </div>
            ))}
            <div className="grid gap-4 border-t border-border bg-surface-raised px-6 py-4 text-sm md:grid-cols-2">
              <p className="flex items-start gap-2 text-text">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden />
                <span>Fact check passed: {EX.factsKept.join(", ")} all come from the original.</span>
              </p>
              <p className="flex items-start gap-2 text-text-secondary">
                <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-muted" aria-hidden />
                <span>In the posting but not in the resume, so not added: {EX.notAdded.join(", ")}.</span>
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className={`${container} scroll-mt-8 py-16 sm:py-20`}>
          <h2 className={h2}>Pricing that fits a job search</h2>
          {poweredBy && <p className="mt-3 text-sm text-text-muted">{POWERED_BY.copy}</p>}
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <div className={`${card} flex flex-col gap-2.5`}>
              <h3 className="text-sm font-semibold text-text-muted">Free</h3>
              <p className="font-serif text-4xl text-text">$0</p>
              <p className="text-sm leading-relaxed text-text-secondary">{FREE_PLAN_SHORT}</p>
            </div>
            <div className="flex flex-col gap-2.5 rounded-card bg-inverse p-6 text-inverse-fg sm:p-7">
              <h3 className="text-sm font-bold opacity-90">{PRICING.pass.name} · best value</h3>
              <p className="font-serif text-4xl">
                {PRICING.pass.amount} <span className="text-lg opacity-80">once</span>
              </p>
              <p className="text-sm leading-relaxed opacity-90">{PRICING.pass.headline}</p>
            </div>
            <div className={`${card} flex flex-col gap-2.5`}>
              <h3 className="text-sm font-semibold text-text-muted">Pro</h3>
              <p className="font-serif text-4xl text-text">
                {PRICING.monthly.amount} <span className="text-lg text-text-muted">/ month</span>
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">{FAIR_USE}</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-text-muted">
            <Link href="/pricing" className="font-semibold text-accent-strong underline underline-offset-4 hover:text-text">
              See everything in each plan
            </Link>
          </p>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className={h2}>Questions</h2>
          <div className="mt-8 divide-y divide-border rounded-card bg-surface">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-6 py-5 [&_a]:text-accent-strong [&_a]:underline">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-text">
                  {item.q}
                  <span className="text-xl leading-none text-text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section className={`${container} flex flex-col items-center gap-6 pb-20 pt-8 text-center`}>
          <Logo variant="hero" height={110} className="hidden sm:inline-flex" />
          <Logo variant="hero" height={80} className="sm:hidden" />
          <p className="max-w-md text-lg text-text-secondary">Tailored to the job. True to you.</p>
          <Button asChild size="lg">
            <Link href="/auth/signin">
              Tailor your first resume <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

/** The hero's illustration of the receipt: one kept bullet, one left-out claim. */
function HeroReceipt() {
  return (
    <figure className="flex flex-col gap-4 rounded-panel bg-surface p-6 shadow-float sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <p className="font-serif text-2xl font-semibold text-text">Senior Engineer, Payments</p>
        <span className="mt-1.5 shrink-0 text-xs font-bold text-success">Invented: 0</span>
      </div>
      <p className="flex gap-3 text-base leading-relaxed text-text">
        <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-inverse text-inverse-fg">
          <Check className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span>Led the migration of 14 services to Kubernetes, cutting deploy time from hours to minutes.</span>
      </p>
      <p className="flex gap-3 text-base leading-relaxed text-text-muted">
        <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-removed text-sm font-bold text-accent-strong" aria-hidden>
          !
        </span>
        <span>
          <s>Increased revenue by 40%</s>
          <span className="sr-only"> (left out)</span>
        </span>
      </p>
      <p className="rounded-2xl bg-removed px-4 py-3.5 text-sm leading-relaxed text-text">
        We left this out. It isn&apos;t in your resume. If revenue really went up, tell us how much and we&apos;ll add it.
      </p>
      <figcaption className="text-xs text-text-muted">Example</figcaption>
    </figure>
  )
}
