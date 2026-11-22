// Public "Is this job real?" check. No account, no AI, nothing saved.
import type { Metadata } from "next"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { JobCheck } from "@/components/site/job-check"
import { OG_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/site"

const TITLE = "Is this job real? Free ghost job and scam checker"
const DESCRIPTION =
  "Paste a job link or post. We check it for scam signs, ghost-job signs, and whether it's still open on the employer's own job board. Free, no sign-up, nothing saved."

export const metadata: Metadata = {
  title: "Ghost job and job scam checker",
  description: DESCRIPTION,
  alternates: { canonical: "/check" },
  openGraph: { ...OG_DEFAULTS, title: TITLE, description: DESCRIPTION, url: "/check" },
  twitter: { ...TWITTER_DEFAULTS, title: TITLE, description: DESCRIPTION },
}

const FAQ = [
  {
    q: "What is a ghost job?",
    a: "A posting that's up but not really being hired for: already filled, paused, or kept up to collect resumes. Most job seekers say they've run into one.",
  },
  {
    q: "What does this check?",
    a: "Scam signs (asking for money, ID, bank details, crypto, chat apps or a code test up front), ghost-job signs (old or reposted, agency or \"talent pool\" wording, no pay listed, 100+ applicants), and, for jobs on Greenhouse, Lever, Ashby, SmartRecruiters and Workday, whether the job is still on the employer's own board. We pull those boards every morning.",
  },
  {
    q: "Is it a verdict?",
    a: "No. It shows facts with a short reason for each. A job with signs can still be real, and a clean result isn't a promise. When in doubt, find the role on the company's own careers page.",
  },
  {
    q: "Do you save what I paste?",
    a: "No. We count that a check ran and which signs showed up, never the text or the link.",
  },
]

export default function CheckPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }
  return (
    <div className="min-h-screen bg-bg text-text">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <span className="rounded-full bg-sage px-3.5 py-2 text-sm font-semibold text-text">Free. No sign-up. Nothing saved.</span>
        <h1 className="mt-6 font-serif text-5xl font-medium leading-[1.05] tracking-tight text-text sm:text-6xl">Is this job real?</h1>
        <p className="mt-5 text-lg leading-relaxed text-text-secondary">
          Before you spend an evening on an application, check the posting for scam signs, ghost-job signs, and whether it&apos;s still open on the
          employer&apos;s own job board.
        </p>
        <JobCheck />
        <section className="mt-16 space-y-6" aria-label="Questions">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h2 className="font-serif text-2xl font-semibold text-text">{f.q}</h2>
              <p className="mt-2 leading-relaxed text-text-secondary">{f.a}</p>
            </div>
          ))}
        </section>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      </main>
      <SiteFooter />
    </div>
  )
}
