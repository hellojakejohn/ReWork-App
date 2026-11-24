import type { Metadata } from "next"
import { InfoPage, Section, Src, VisaCta, type Faq } from "@/components/site/info-page"
import { OG_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/site"

const TITLE = "Visa sponsorship jobs: how to tell before you apply"
const DESCRIPTION = "Two checks that save applications when you'll need an H-1B: what the job post says about sponsorship, and whether the employer has H-1B approvals on record with USCIS."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/visa-sponsorship-jobs" },
  openGraph: { ...OG_DEFAULTS, title: `${TITLE} | ReWork`, description: DESCRIPTION, url: "/visa-sponsorship-jobs" },
  twitter: { ...TWITTER_DEFAULTS, title: `${TITLE} | ReWork`, description: DESCRIPTION },
}

const HUB = "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub"

const FAQS: Faq[] = [
  { q: "Does an H-1B record mean this job will sponsor me?", a: "No. It means the employer has had H-1B workers approved before. Sponsorship is decided role by role, and a company that filed last year can still say no this year. It tells you where sponsorship has really happened." },
  { q: "Where does the H-1B data come from?", a: "USCIS's H-1B Employer Data Hub, which publishes employers' approved and denied petitions by fiscal year. ReWork matches each job's company to it by name." },
  { q: "Why does a big company show \"No H-1B record found\"?", a: "Companies often file under a legal name that differs from the name on their job board, or under a parent company. Treat \"no record\" as a reason to look closer, not a final answer." },
  { q: "What does \"the post says no visa sponsorship\" mean?", a: "The job text itself rules it out, with lines like \"unable to sponsor\" or \"must be authorized to work without sponsorship\". That is about this job, so it outweighs the company's history." },
  { q: "Is sponsorship the same as E-Verify?", a: "No. E-Verify confirms work eligibility for new hires. It matters for the STEM OPT extension, which needs an E-Verify employer, but being enrolled says nothing about whether a company sponsors H-1B visas." },
  { q: "Is this free?", a: "Yes. The sponsorship signals on your job matches are free on every plan." },
]

export default function VisaSponsorshipJobs() {
  return (
    <InfoPage
      eyebrow="For job seekers who will need a visa"
      title="Spend your applications on employers that sponsor"
      intro={DESCRIPTION}
      faqs={FAQS}
      note="This page explains how ReWork's sponsorship signals work. It is not immigration advice: whether a role can be sponsored is the employer's decision, and an immigration attorney or your school's DSO has the final word on your own status."
    >
      <Section title="Why it matters">
        <p>
          An H-1B is filed by the employer, not by you, and many employers never file at all. Job posts rarely say so up front. The question usually shows up as a checkbox on the application form, after you have already tailored a resume and written a letter for it.
        </p>
        <p>Two checks catch most of these before you spend the time.</p>
      </Section>
      <Section title="Check 1: what the job post says">
        <p>
          Many posts say it plainly, near the bottom: &ldquo;We are unable to sponsor visas for this role&rdquo; or &ldquo;Visa sponsorship is available.&rdquo; That line is about this exact job, so it beats anything else. ReWork reads every matched post for it and shows the result on the match.
        </p>
      </Section>
      <Section title="Check 2: the employer's H-1B record">
        <p>
          USCIS publishes which employers have had H-1B petitions approved, year by year, in its <Src href={HUB}>H-1B Employer Data Hub</Src>. Few people look each company up. ReWork does, and shows the count next to the job: &ldquo;H-1B: 1,240 approved.&rdquo;
        </p>
        <p>
          It is a record of the past, not a promise. But it moves your applications toward companies where sponsorship has really happened, and away from the ones where it never has.
        </p>
      </Section>
      <Section title="Then the rest of the search">
        <ul className="list-disc space-y-1 pl-5">
          <li>Turn on &ldquo;Possible sponsors only&rdquo; to hide posts that rule it out and employers with no approvals on record.</li>
          <li>Matches are ranked by how much of each job your resume already shows.</li>
          <li>Tailor your resume and cover letter for the jobs that are left. Every rewrite is checked against your resume: nothing invented.</li>
        </ul>
      </Section>
      <VisaCta />
    </InfoPage>
  )
}
