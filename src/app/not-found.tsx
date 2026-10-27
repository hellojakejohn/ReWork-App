import Link from "next/link"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text-secondary">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold text-text-muted">404</p>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight text-text sm:text-5xl">This page isn&apos;t here.</h1>
        <p className="mt-3 max-w-prose">The link may be old or mistyped. Your resumes and tailored jobs are safe in your dashboard.</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/dashboard">Go to your dashboard</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
