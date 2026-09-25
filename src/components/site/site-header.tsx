import Link from "next/link"
import Image from "next/image"

// Header for the public pages. Server component, no client JS.
export function SiteHeader({ links = true }: { links?: boolean }) {
  return (
    <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white">
          <Image src="/rework-logo-simple-cropped.png" alt="" width={28} height={28} priority />
          ReWork
        </Link>
        {links && (
          <nav aria-label="Main" className="flex items-center gap-4 text-sm">
            <Link href="/#how-it-works" className="hidden text-slate-300 hover:text-white sm:inline">How it works</Link>
            <Link href="/pricing" className="text-slate-300 hover:text-white">Pricing</Link>
            <Link href="/auth/signin" className="rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-emerald-400">
              Get started free
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
