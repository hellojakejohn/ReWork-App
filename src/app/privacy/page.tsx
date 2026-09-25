import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, Section } from "@/components/site/legal-page"
import { CONTACT_EMAIL } from "@/lib/plans"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What ReWork collects, who processes it, how long it's kept, and how to download or delete it.",
  alternates: { canonical: "/privacy" },
}

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary={
        <ul className="list-disc space-y-1 pl-5">
          <li>ReWork is run by one person, Jakob Johnson, in Saint Paul, Minnesota.</li>
          <li>We store your resume, the jobs you tailor for, and what we write for you, so you can come back to it.</li>
          <li>Resume and job text is sent to OpenAI’s API to do the rewriting. OpenAI doesn’t use API data to train its models.</li>
          <li>We don’t sell your data, show ads, or share your resume with employers.</li>
          <li>You can download everything or delete your account any time from Settings, Your data.</li>
        </ul>
      }
    >
      <Section title="Who we are">
        <p>
          ReWork (rework.hellojakejohn.com) is operated by Jakob Johnson, an individual based in Saint Paul, Minnesota, USA (&quot;we&quot;, &quot;us&quot;). Questions
          about your data go to {mail}.
        </p>
      </Section>

      <Section title="What we collect">
        <ul>
          <li>
            <strong>Your Google account basics.</strong> When you sign in with Google we get your name, email address, profile picture URL and
            Google account ID. We don’t request access to Gmail, Drive, Contacts or anything else in your Google account.
          </li>
          <li>
            <strong>Resumes you upload or paste.</strong> The original file, the text we extract from it, and the structured version (roles,
            bullets, education, skills) that you can edit.
          </li>
          <li>
            <strong>Jobs you tailor for.</strong> The job link you paste, and the job title, company, location and description we read from it or
            that you paste.
          </li>
          <li>
            <strong>What we generate for you.</strong> Tailored resumes, cover letters, and your answers in the evidence interview.
          </li>
          <li>
            <strong>Your application tracker.</strong> Status, notes and follow-up dates you enter.
          </li>
          <li>
            <strong>Billing status.</strong> If you pay, Stripe handles your card. We store your Stripe customer ID, which plan you have and when it
            ends. We never see or store your card number.
          </li>
          <li>
            <strong>Usage events.</strong> Which features you used and when, how long they took, whether they failed, and how many AI tokens they
            used. These never contain your resume or job text.
          </li>
          <li>
            <strong>Page views.</strong> Vercel Web Analytics counts page views without cookies and without identifying you.
          </li>
          <li>
            <strong>Server logs.</strong> Our host (Vercel) keeps standard request logs, such as IP address, browser and time, for a short period.
          </li>
          <li>
            <strong>Feedback</strong> you send us through the app or by email.
          </li>
        </ul>
      </Section>

      <Section title="How we use it">
        <ul>
          <li>To run the service: read your resume, tailor it to a job, check the result against your original, write cover letters, and keep your history and tracker.</li>
          <li>To handle billing and plan limits.</li>
          <li>To find and fix problems, prevent abuse, and understand which parts of the product people use.</li>
          <li>To reply when you contact us.</li>
        </ul>
        <p>
          We don’t sell your data, we don’t use it for advertising, and we don’t share your resume with employers or recruiters. We don’t use your
          resume to train AI models.
        </p>
      </Section>

      <Section title="Who processes it for us">
        <p>These companies handle data on our behalf, only to provide their service to us:</p>
        <ul>
          <li>
            <strong>Supabase</strong>: our database and file storage, hosted on AWS in the US (Oregon, us-west-2). Your resumes, tailored versions,
            cover letters, tracker and account live here.
          </li>
          <li>
            <strong>Vercel</strong>: hosts the website and API, keeps request logs, and provides cookieless page-view analytics.
          </li>
          <li>
            <strong>OpenAI</strong>: when you parse a resume, tailor, write a cover letter, run the evidence interview or fetch some job pages, the
            relevant text is sent to OpenAI’s API to generate the result. Under OpenAI’s API data policy, data sent through the API is not used to
            train their models. OpenAI may keep API data for a limited time to monitor for abuse, under its own policy (see{" "}
            <a href="https://openai.com/policies/privacy-policy/" rel="noopener noreferrer">OpenAI’s privacy policy</a>).
          </li>
          <li>
            <strong>Stripe</strong>: payments, receipts, subscriptions and the billing portal. Stripe is responsible for your card details.
          </li>
          <li>
            <strong>Google</strong>: sign-in.
          </li>
        </ul>
        <p>
          When you paste a job link, our server fetches that page (or the job board’s public API) to read the posting. The job site sees a request
          from our server, not from you.
        </p>
      </Section>

      <Section title="How long we keep it, and deleting it">
        <ul>
          <li>We keep your data while your account exists, so your resumes and history are there when you come back.</li>
          <li>
            Deleting a single resume removes it from your account. Tailored versions you already made from it keep their own copy until you delete
            them or your account.
          </li>
          <li>
            <strong>Deleting your account</strong> (Settings, Your data, Delete my account) cancels any Pro subscription, deletes your uploaded
            files, and deletes your account, resumes, tailored versions, cover letters, tracker and feedback from our database right away. Database
            backups held by Supabase age out on their normal schedule.
          </li>
          <li>Usage events are kept after account deletion with the link to you removed, so they can’t be tied back to you.</li>
          <li>Stripe keeps records of past payments, as payment processors are required to.</li>
        </ul>
      </Section>

      <Section title="Your choices and rights">
        <ul>
          <li>
            <strong>Download your data</strong>: Settings, Your data, Download my data gives you a JSON file of everything in your account.
          </li>
          <li>
            <strong>Correct it</strong>: edit your resume in the app any time.
          </li>
          <li>
            <strong>Delete it</strong>: delete resumes one at a time, or your whole account.
          </li>
          <li>For anything else, including questions under privacy laws where you live, email {mail}. We’ll answer within 30 days.</li>
        </ul>
      </Section>

      <Section title="Cookies and local storage">
        <p>
          We use one essential cookie to keep you signed in, plus the cookies Google and Stripe set during sign-in and checkout. Your browser’s
          local storage remembers small preferences like your resume template and avatar color. We don’t use advertising or cross-site tracking
          cookies.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Traffic is encrypted with HTTPS. Uploaded files are kept in a private storage bucket, and database access is limited to our server. No
          system is perfectly secure; if we learn of a breach that affects your data, we’ll tell you by email.
        </p>
      </Section>

      <Section title="Children">
        <p>ReWork isn’t meant for anyone under 16, and we don’t knowingly collect data from them.</p>
      </Section>

      <Section title="Changes">
        <p>
          If we change this policy, we’ll update the date at the top. If a change affects how we use data you’ve already given us, we’ll email you
          before it takes effect.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Jakob Johnson, Saint Paul, Minnesota, USA. Email {mail}. See also the <Link href="/terms">Terms of Service</Link>.
        </p>
      </Section>
    </LegalPage>
  )
}
