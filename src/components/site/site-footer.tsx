import Link from "next/link"
import { CONTACT_EMAIL } from "@/lib/plans"

// Footer for the public pages (landing, pricing, terms, privacy). Server component.
export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/60">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-400 sm:flex-row">
        <p>© {new Date().getFullYear()} ReWork · Made in Saint Paul, MN</p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/pricing" className="hover:text-white">Pricing</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">Contact</a>
        </nav>
      </div>
    </footer>
  )
}
