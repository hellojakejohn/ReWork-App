import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, Section } from "@/components/site/legal-page"
import { CONTACT_EMAIL, DAILY_CEILINGS, FREE_PLAN_SUMMARY, PASS_DAYS, PRICING } from "@/lib/plans"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using ReWork: your content, acceptable use, Pro plans, cancellation and refunds.",
  alternates: { canonical: "/terms" },
}

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary={
        <ul className="list-disc space-y-1 pl-5">
          <li>Your resume is yours. We only use it to run the service for you.</li>
          <li>We check every rewrite against your resume, but AI can still make mistakes. Read what you send before you send it.</li>
          <li>
            {PRICING.monthly.name} is {PRICING.monthly.display} and renews until you cancel. Cancel any time; you keep Pro until the end of the
            period you paid for.
          </li>
          <li>
            The {PRICING.pass.name} is {PRICING.pass.amount} for {PASS_DAYS} days and never renews. It’s non-refundable once you’ve used it.
          </li>
          <li>Otherwise, ask within 7 days of a payment and we’ll refund it.</li>
        </ul>
      }
    >
      <Section title="Who we are and agreeing to these terms">
        <p>
          ReWork is operated by Jakob Johnson, an individual based in Saint Paul, Minnesota, USA (&quot;we&quot;, &quot;us&quot;). By creating an account or using
          ReWork you agree to these terms and to the <Link href="/privacy">Privacy Policy</Link>. If you don’t agree, please don’t use ReWork.
        </p>
      </Section>

      <Section title="What ReWork does">
        <p>
          ReWork reads your resume, tailors it to a job posting you choose, writes cover letters, runs an evidence interview to strengthen your
          bullets with facts you provide, tracks your applications, and exports PDF and Word files. Rewrites are checked against your original
          resume and your own answers, and anything we can’t match is flagged or removed.
        </p>
        <p>
          That check reduces mistakes; it doesn’t eliminate them. <strong>You’re responsible for reviewing everything before you send it to an
          employer</strong>, and for making sure it’s true. We don’t promise interviews, offers, or that any applicant tracking system will rank you
          a certain way.
        </p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>You sign in with Google. You must be at least 16 and use ReWork for yourself.</li>
          <li>Keep your Google account secure; you’re responsible for what happens under your ReWork account.</li>
          <li>You can delete your account any time from Settings, Your data.</li>
        </ul>
      </Section>

      <Section title="Your content">
        <ul>
          <li>You own your resume, your answers, and what ReWork generates for you.</li>
          <li>
            You give us permission to store and process your content, including sending it to our AI provider, only to run ReWork for you. That
            permission ends when you delete the content or your account.
          </li>
          <li>Only upload resumes and information you have the right to use. Don’t upload other people’s personal data without their permission.</li>
        </ul>
      </Section>

      <Section title="Fair use">
        <ul>
          <li>No scraping, automated or scripted use, reselling access, or using ReWork as an API for another product.</li>
          <li>Don’t try to break, overload, or get around the limits or security of the service.</li>
          <li>Don’t use ReWork to create false or misleading credentials.</li>
          <li>
            Every account, Pro included, has daily limits ({DAILY_CEILINGS.tailor} tailored resumes, {DAILY_CEILINGS.coverLetter} cover letters and{" "}
            {DAILY_CEILINGS.parse} resume uploads per day) to protect the service from scripts. Real job searches don’t come close.
          </li>
        </ul>
        <p>We may suspend accounts that break these rules. If we do, we’ll tell you why by email.</p>
      </Section>

      <Section title="Plans and billing">
        <ul>
          <li>
            <strong>Free</strong>: {FREE_PLAN_SUMMARY}. No card needed.
          </li>
          <li>
            <strong>{PRICING.monthly.name}</strong>: {PRICING.monthly.display}, billed monthly through Stripe until you cancel. Cancel any time in
            the billing portal (Settings, Plan & billing). You keep Pro until the end of the month you paid for; we don’t charge again after that.
          </li>
          <li>
            <strong>{PRICING.pass.name}</strong>: {PRICING.pass.amount} once, for {PASS_DAYS} days of Pro. It doesn’t renew. Buying another while
            one is active adds {PASS_DAYS} days.
          </li>
          <li>Prices are in US dollars. Stripe may add sales tax where it applies.</li>
          <li>If we change the price of {PRICING.monthly.name}, we’ll email you at least 14 days before your next charge at the new price.</li>
        </ul>
      </Section>

      <Section title="Refunds">
        <ul>
          <li>
            <strong>{PRICING.pass.name}</strong>: non-refundable once you’ve used it, meaning you’ve tailored a resume, written a cover letter, or
            used any Pro feature after buying it. If you haven’t used it, we’ll refund it if you ask within 7 days.
          </li>
          <li>
            <strong>{PRICING.monthly.name}</strong>: ask within 7 days of a charge (your first payment or a renewal) and we’ll refund that charge.
          </li>
          <li>To ask, email {mail} from the address you sign in with. Refunds go back to the original card through Stripe.</li>
        </ul>
      </Section>

      <Section title="Changes and availability">
        <p>
          We’re improving ReWork all the time and may change or remove features. If a change takes away something you’ve paid for, we’ll refund
          the unused part. We aim to keep ReWork running but can’t promise it will never be down.
        </p>
      </Section>

      <Section title="Disclaimers and limits">
        <p>
          ReWork is provided &quot;as is&quot;, without warranties of any kind, to the extent the law allows. To the extent the law allows, we’re not liable
          for indirect or consequential losses (like a missed job), and our total liability to you is limited to what you paid us in the 12 months
          before the claim.
        </p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of the State of Minnesota, USA. Any dispute goes to the state or federal courts in Ramsey County, Minnesota.</p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          If we change these terms, we’ll update the date at the top. For changes that matter, like pricing or refunds, we’ll email you before they
          take effect. Using ReWork after that means you accept the new terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>Jakob Johnson, Saint Paul, Minnesota, USA. Email {mail}.</p>
      </Section>
    </LegalPage>
  )
}
