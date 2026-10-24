import Link from "next/link"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"

// Header for the public pages (landing, pricing, sign-in, legal). Server component, no client JS.
export function SiteHeader({ links = true }: { links?: boolean }) {
  return (
    <header className="bg-bg">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <Link href="/" aria-label="rework home" className="-ml-1 rounded-input">
          <Logo height={44} priority />
        </Link>
        {links && (
          <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
            <Link href="/#how-it-works" className="hidden rounded-full px-3 py-2 text-text-secondary hover:text-text md:inline">How it works</Link>
            <Link href="/pricing" className="rounded-full px-2 py-2 text-text-secondary hover:text-text sm:px-3">Pricing</Link>
            <Link href="/auth/signin" className="hidden rounded-full px-3 py-2 text-text-secondary hover:text-text sm:inline">Sign in</Link>
            <Button asChild variant="inverse" size="md" className="ml-1">
              <Link href="/auth/signin">Get started</Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  )
}
