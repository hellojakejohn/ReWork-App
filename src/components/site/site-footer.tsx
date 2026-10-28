import Link from "next/link"
import { CONTACT_EMAIL } from "@/lib/plans"

// Footer for the public pages (landing, pricing, sign-in, terms, privacy). Server component.
export function SiteFooter() {
  return (
    <footer className="bg-bg">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 border-t border-border py-8 text-sm text-text-muted sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} ReWork. Made in Saint Paul, MN.</p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/pricing" className="underline-offset-4 hover:text-text hover:underline">Pricing</Link>
            <Link href="/privacy" className="underline underline-offset-4 hover:text-text">Privacy</Link>
            <Link href="/terms" className="underline underline-offset-4 hover:text-text">Terms</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline-offset-4 hover:text-text hover:underline">Contact</a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
