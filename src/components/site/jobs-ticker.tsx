// Landing page band: the live open-jobs count and a slow ticker of real, newest jobs from
// the feed (src/lib/feed/public-stats.ts). Server component, CSS-only motion.
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { JobsTicker as Ticker } from "@/lib/feed/public-stats"

const nf = new Intl.NumberFormat("en-US")

export function JobsTicker({ ticker }: { ticker: Ticker }) {
  const items = ticker.recent
  return (
    <section aria-label="Open jobs right now" className="border-y border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pb-2 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2.5 text-sm text-text-secondary">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <span>
            <strong className="font-semibold tabular-nums text-text">{nf.format(ticker.openJobs)}</strong> open jobs at{" "}
            <strong className="font-semibold tabular-nums text-text">{nf.format(ticker.employers)}</strong> employers, checked daily
          </span>
        </p>
        <Link href="/auth/signin" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline">
          See which fit you <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {items.length > 0 && (
        <div className="ticker relative overflow-hidden pb-4 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
          <ul className="ticker-track flex w-max gap-3">
            {[...items, ...items].map((job, i) => (
              <li
                key={i}
                aria-hidden={i >= items.length || undefined}
                className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap rounded-full border border-border bg-bg px-3.5 py-1.5 text-sm"
              >
                <span className="font-medium text-text">{job.title}</span>
                <span className="text-text-muted">{job.company}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
