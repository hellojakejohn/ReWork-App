import type { Metadata } from "next"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { SaveJob } from "./save-job"

export const metadata: Metadata = {
  title: "Save jobs from LinkedIn and Indeed",
  description: "A one-click button that brings the job you're looking at on LinkedIn, Indeed or any job site into ReWork.",
  alternates: { canonical: "/save" },
}

export default function SavePage() {
  return (
    <div className="min-h-screen bg-bg text-text-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <SaveJob />
      </main>
      <SiteFooter />
    </div>
  )
}
