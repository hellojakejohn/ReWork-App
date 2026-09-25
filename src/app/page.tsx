// Landing page. A server component on purpose: no animation libraries, no client JS of
// its own (except the one-line "account deleted" notice), so it paints fast on mobile.
// Every number comes from src/lib/plans.ts.
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Briefcase, Check, FileText, FileUp, ListChecks, MessageSquareText, ShieldCheck, Sparkles, X } from "lucide-react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { DeletedNotice } from "@/components/site/deleted-notice"
import { LANDING_EXAMPLE as EX } from "@/components/site/landing-example"
import { OG_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/site"
import { CONTACT_EMAIL, FREE_FEATURES, FREE_TAILORS_PER_MONTH, PASS_DAYS, PRICING, PRO_FEATURES } from "@/lib/plans"

const TITLE = "ReWork: tailor your resume to any job in under a minute. Nothing made up."
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
    icon: FileUp,
    title: "Upload your resume",
    body: "PDF, Word, or pasted text. We read it once and check every detail against your file, so you only fix what's wrong.",
  },
  {
    icon: Briefcase,
    title: "Paste a job link",
    body: "Greenhouse, Lever, Ashby, Workday and most company career pages fill in on their own. Anything else, paste the text.",
  },
  {
    icon: FileText,
    title: "Get your tailored resume + cover letter",
    body: "Rewritten for that job, with a reason for every change. Keep or revert each bullet, then download a PDF.",
  },
]

const PRO_DETAILS = [
  { icon: Sparkles, title: "Unlimited tailoring", body: `Tailor for every job you apply to, not ${FREE_TAILORS_PER_MONTH} a month.` },
  { icon: MessageSquareText, title: "Cover letters", body: "One per job, in your tone, fact-checked the same way as your resume." },
  { icon: ShieldCheck, title: "Evidence interview", body: "We ask for your real numbers, then rewrite your weakest bullets using only your answers." },
  { icon: ListChecks, title: "Tracker + Word export", body: "Track every application, and download .docx files for portals that prefer Word." },
]

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is anything made up?",
    a: (
      <>
        No. After every rewrite a fact guard compares the result with your resume: numbers, employers, titles, dates, tools and credentials. Anything
        your resume doesn't support is removed or flagged, and every changed bullet comes with the reason for the change so you can keep it or
        revert it. When a bullet needs a number, the evidence interview asks you for it instead of guessing.
      </>
    ),
  },
  {
    q: "Does it work with applicant tracking systems (ATS)?",
    a: (
      <>
        The templates are single-column with standard section headings, and PDFs contain real, selectable text. Pro adds Word downloads built from
        plain paragraphs, with no tables or text boxes, which is what application portals parse most reliably. We don't promise an &quot;ATS
        score&quot;; nobody honestly can.
      </>
    ),
  },
  {
    q: "What happens to my data?",
    a: (
      <>
        Your resumes and results are stored in our database so they&apos;re there when you come back. Resume and job text is sent to OpenAI&apos;s API
        to do the rewriting; under OpenAI&apos;s API policy it isn&apos;t used to train their models. We never sell it or share it with employers.
        You can download everything or delete your account any time from Settings. Details in the <Link href="/privacy">privacy policy</Link>.
      </>
    ),
  },
  {
    q: "Which job sites work?",
    a: (
      <>
        Links from Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable and most company career pages fill in automatically. LinkedIn,
        Indeed, Glassdoor and ZipRecruiter block apps from reading their pages, so for those, copy the job description and paste it in.
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

const container = "mx-auto max-w-5xl px-4"
const h2 = "text-2xl font-bold tracking-tight text-white sm:text-3xl"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <DeletedNotice />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="bg-gradient-to-b from-slate-900 to-slate-950">
          <div className={`${container} py-16 text-center sm:py-24`}>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
              Tailor your resume to any job in under a minute. <span className="text-emerald-400">Nothing made up.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
              Upload your resume once, paste a job link, and get a resume and cover letter written for that job. Every rewrite is checked against what
              you actually wrote. No invented metrics, no fake skills.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link
                href="/auth/signin"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-lg font-semibold text-slate-950 hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              >
                Get started free <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <p className="text-sm text-slate-400">{FREE_TAILORS_PER_MONTH} free tailors a month, no card</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16 py-16">
          <div className={container}>
            <h2 className={`${h2} text-center`}>How it works</h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-xl border border-white/10 bg-slate-800/40 p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-300">
                      {i + 1}
                    </span>
                    <step.icon className="h-5 w-5 text-slate-300" aria-hidden />
                  </div>
                  <h3 className="mt-4 font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Before / after */}
        <section className="border-y border-white/5 bg-slate-900/50 py-16">
          <div className={container}>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className={h2}>What a tailor looks like</h2>
              <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                Example
              </span>
            </div>
            <p className="mt-3 max-w-3xl text-slate-300">
              {EX.person}, tailored for an {EX.job}. Same facts, pointed at the job. Every number on the right is already on the left.
            </p>

            <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
              <div className="grid grid-cols-1 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-400 md:grid-cols-2">
                <div className="px-5 py-3">Your resume</div>
                <div className="hidden px-5 py-3 md:block">Tailored</div>
              </div>
              {[{ before: EX.summary.before, after: EX.summary.after, why: "Summary leads with what this job needs." }, ...EX.bullets].map((row) => (
                <div key={row.before} className="grid grid-cols-1 border-b border-white/5 last:border-b-0 md:grid-cols-2">
                  <p className="px-5 py-4 text-sm leading-relaxed text-slate-400">{row.before}</p>
                  <div className="px-5 pb-4 md:py-4">
                    <p className="text-sm leading-relaxed text-white">{row.after}</p>
                    <p className="mt-1 text-xs text-emerald-300">Why: {row.why}</p>
                  </div>
                </div>
              ))}
              <div className="grid gap-4 border-t border-white/10 bg-slate-900/60 px-5 py-4 text-sm md:grid-cols-2">
                <p className="flex items-start gap-2 text-slate-200">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" aria-hidden />
                  <span>Fact check passed: {EX.factsKept.join(", ")} all come from the original.</span>
                </p>
                <p className="flex items-start gap-2 text-slate-300">
                  <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
                  <span>In the posting but not in the resume, so not added: {EX.notAdded.join(", ")}.</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What Pro adds */}
        <section className="py-16">
          <div className={container}>
            <h2 className={h2}>What Pro adds</h2>
            <p className="mt-3 max-w-2xl text-slate-300">Free covers a few applications a month. Pro is for an active search.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {PRO_DETAILS.map((item) => (
                <div key={item.title} className="flex gap-4 rounded-xl border border-white/10 bg-slate-800/40 p-5">
                  <item.icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" aria-hidden />
                  <div>
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-16 border-y border-white/5 bg-slate-900/50 py-16">
          <div className={container}>
            <h2 className={`${h2} text-center`}>Pricing</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-300">Start free. Pay by the month, or once for a single job hunt.</p>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              <PlanCard name="Free" price="$0" period="forever" features={FREE_FEATURES} cta="Get started free" note="No card needed." />
              <PlanCard
                name={PRICING.monthly.name}
                price={PRICING.monthly.amount}
                period={PRICING.monthly.period}
                features={PRO_FEATURES}
                cta="Start free, upgrade anytime"
                note={PRICING.monthly.cadence}
                highlight
              />
              <PlanCard
                name={PRICING.pass.name}
                price={PRICING.pass.amount}
                period={`one-time, ${PASS_DAYS} days`}
                features={[`Everything in Pro for ${PASS_DAYS} days`, ...PRO_FEATURES.slice(1)]}
                cta="Start free, upgrade anytime"
                note={PRICING.pass.cadence}
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className={h2}>Questions</h2>
            <div className="mt-6 divide-y divide-white/10 rounded-xl border border-white/10">
              {FAQ.map((item) => (
                <details key={item.q} className="group px-5 py-4 [&_a]:text-emerald-300 [&_a]:underline">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-white">
                    {item.q}
                    <span className="text-slate-400 transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.a}</p>
                </details>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link
                href="/auth/signin"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Tailor your first resume <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function PlanCard({
  name,
  price,
  period,
  features,
  cta,
  note,
  highlight = false,
}: {
  name: string
  price: string
  period: string
  features: string[]
  cta: string
  note: string
  highlight?: boolean
}) {
  return (
    <div className={`flex flex-col rounded-xl border p-6 ${highlight ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 bg-slate-800/40"}`}>
      <h3 className="font-semibold text-white">{name}</h3>
      <p className="mt-2 text-3xl font-bold text-white">
        {price}
        <span className="ml-1 text-sm font-normal text-slate-400">{period}</span>
      </p>
      <ul className="mt-5 flex-1 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-200">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-slate-400">{note}</p>
      <Link
        href="/auth/signin"
        className={`mt-3 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
          highlight ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "border border-white/20 text-white hover:bg-white/10"
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}
