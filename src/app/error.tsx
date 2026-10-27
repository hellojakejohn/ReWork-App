"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { CONTACT_EMAIL } from "@/lib/plans"

// Any render error below the root layout lands here instead of a blank page. The digest
// matches the server log line in Vercel, so a user can quote it.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-start justify-center gap-4 bg-bg px-4 py-16 text-text-secondary sm:px-10">
      <Link href="/" aria-label="rework home">
        <Logo height={40} />
      </Link>
      <h1 className="font-serif text-4xl font-medium tracking-tight text-text">Something broke on our side.</h1>
      <p className="max-w-prose">
        Nothing you saved is lost. Try again, and if it keeps happening, email{" "}
        <a className="font-semibold text-text underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        {error.digest ? ` with code ${error.digest}` : ""}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Go to your dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
