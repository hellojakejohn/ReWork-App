import type { Metadata } from "next"
import { InfoPage, Section, Src, VisaCta, type Faq } from "@/components/site/info-page"
import { OG_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/site"

const TITLE = "OPT unemployment days: the 90 and 150 day limits"
const DESCRIPTION = "On F-1 OPT you can be unemployed for 90 days in total, or 150 with the STEM extension. How the days are counted, and how to spend them on jobs that can keep you."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/opt-unemployment-days" },
  openGraph: { ...OG_DEFAULTS, title: `${TITLE} | ReWork`, description: DESCRIPTION, url: "/opt-unemployment-days" },
  twitter: { ...TWITTER_DEFAULTS, title: `${TITLE} | ReWork`, description: DESCRIPTION },
}

const OPT = "https://studyinthestates.dhs.gov/sevis-help-hub/student-records/fm-student-employment/f-1-optional-practical-training-opt"
const STEM = "https://studyinthestates.dhs.gov/stem-opt-hub/stem-opt-extension-overview"

const FAQS: Faq[] = [
  { q: "How many days can I be unemployed on OPT?", a: "90 days in total during post-completion OPT. With the 24-month STEM OPT extension, the limit is 150 days in total." },
  { q: "Do my unemployment days reset with the STEM extension?", a: "No. The 150 includes the days you already used on post-completion OPT. Use 40 days before the extension and you have 110 left." },
  { q: "Are the days counted in a row or in total?", a: "In total. Separate stretches of unemployment add up against the same limit." },
  { q: "What counts as a day of unemployment?", a: "A day your SEVIS record shows no employer. A job you started but haven't reported can still count against you, so report employment to your DSO as soon as it begins." },
  { q: "How many hours do I need to work?", a: "On post-completion OPT, work must be at least 20 hours a week to count. On STEM OPT, at least 20 hours a week for an employer enrolled in E-Verify." },
  { q: "Does my employer need to be in E-Verify?", a: "For the STEM OPT extension, yes. If you will need the extension, a job at an employer that isn't enrolled can't carry you into it." },
]

export default function OptUnemploymentDays() {
  return (
    <InfoPage
      eyebrow="For F-1 students on OPT"
      title="90 days on OPT, 150 with the STEM extension"
      intro="That is the total time you can be unemployed while on F-1 OPT, and the clock starts at your OPT start date whether or not you have a job lined up. Here is how it is counted, from the Department of Homeland Security's own guidance."
      faqs={FAQS}
      note="This page summarizes public DHS guidance as of November 2026. It is not immigration advice: your Designated School Official (DSO) has the final word on your OPT and STEM OPT status."
    >
      <Section title="The limits">
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-text">
              <tr className="border-b border-border">
                <th className="p-3 font-semibold">OPT period</th>
                <th className="p-3 font-semibold">Unemployment allowed</th>
                <th className="p-3 font-semibold">Work that counts</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3">Post-completion OPT</td>
                <td className="p-3">90 days in total</td>
                <td className="p-3">20+ hours a week, related to your degree</td>
              </tr>
              <tr>
                <td className="p-3">24-month STEM OPT extension</td>
                <td className="p-3">60 more: 150 days in total</td>
                <td className="p-3">20+ hours a week, for an E-Verify employer</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The 150 is not a fresh start. It includes the days you used on post-completion OPT. A day counts as unemployed when your SEVIS record shows no employer, so report a new job to your DSO as soon as you start.
        </p>
        <p className="text-sm">
          Sources: <Src href={OPT}>F-1 Optional Practical Training</Src> and <Src href={STEM}>STEM OPT Extension Overview</Src>, Study in the States (DHS).
        </p>
      </Section>
      <Section title="Spend the days on jobs that can keep you">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-text">Read the post for sponsorship.</span> &ldquo;Unable to sponsor&rdquo; near the bottom of a post ends the conversation later. ReWork flags it on every match.
          </li>
          <li>
            <span className="font-semibold text-text">Check the employer&apos;s H-1B history.</span> If you will want an H-1B after OPT, companies with approvals on record are a better bet. ReWork shows the USCIS count next to each job.
          </li>
          <li>
            <span className="font-semibold text-text">If you will need the STEM extension, ask about E-Verify.</span> It is a quick question for the recruiter, and the answer decides whether the job can carry you into STEM OPT.
          </li>
          <li>
            <span className="font-semibold text-text">Send fewer, better applications.</span> Tailor each resume to the job in about a minute, checked against your own resume so nothing is invented.
          </li>
        </ul>
      </Section>
      <VisaCta />
    </InfoPage>
  )
}
