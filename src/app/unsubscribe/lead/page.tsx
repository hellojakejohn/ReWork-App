import type { Metadata } from "next"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { UnsubscribeButton } from "../unsubscribe-button"

export const metadata: Metadata = {
  title: "Unsubscribe | ReWork",
  robots: { index: false, follow: false },
}

// For emails from the free job check and fit check (src/lib/leads.ts). A button, not an
// unsubscribe on GET: mail scanners open every link.
export default async function LeadUnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  return (
    <div className="min-h-screen bg-bg text-text-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <h1 className="font-serif text-4xl font-medium tracking-tight text-text">ReWork emails</h1>
        <p className="mt-4 leading-relaxed">Stop the emails you asked for on the free job check or fit check. One click, and we won&apos;t write again.</p>
        <div className="mt-8">
          {t ? (
            <UnsubscribeButton token={t} endpoint="/api/leads/unsubscribe" label="Unsubscribe" done="Done. You won't get any more emails from us." />
          ) : (
            <p className="text-text">This link is missing its code. Open the link from the email again.</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
