import type { Metadata } from "next"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { UnsubscribeButton } from "./unsubscribe-button"

export const metadata: Metadata = {
  title: "Unsubscribe | ReWork",
  robots: { index: false, follow: false },
}

// A page with one button, not an unsubscribe on GET: mail scanners open every link in an
// email, and they'd unsubscribe people who never clicked.
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  return (
    <div className="min-h-screen bg-bg text-text-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-text">Weekly job emails</h1>
        <p className="mt-4 leading-relaxed">
          Stop the Monday email with new jobs that fit your resume. Your account, resumes and tracker stay as they are, and you can turn it back on in Settings.
        </p>
        <div className="mt-8">
          {t ? <UnsubscribeButton token={t} /> : <p className="text-text">This link is missing its code. Open the link from the email again, or turn emails off in Settings.</p>}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
