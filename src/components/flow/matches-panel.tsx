"use client"

// Matches on upload: "What job do you want next?" once, then the open jobs that fit this
// resume, best real match first. Tailor fills the Job card with the full post: no link to
// paste. Shown on the Job card (the step right after the upload) and, shorter, on Home.
import { ADZUNA_HOME, ADZUNA_LABEL, ADZUNA_LABEL_MIN } from '@/lib/feed/adzuna-label'
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Banknote, Bookmark, BookmarkCheck, Clock, Loader2, MapPin, RefreshCw, Search, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { cn, skillLabel } from "@/lib/utils"
import { usState } from "@/lib/feed/prefilter"
import { matchAgeNote } from "@/lib/job-checks"
import { findMatches, loadFeed, markMatch, openMatch, type FeedDTO, type FeedMatchDTO, type JobDraft, type Workplace } from "./api"
import { ErrorNote, StageList, inputClass } from "./ui"
import { TapeMeasure } from "@/components/ui/tailor"
import { SkillDemandCard } from "./gap-plans"
import { VISA_EVENT, VISA_KEY, VISA_ONLY_KEY, readFlag, writeFlag } from "@/lib/visa/visa-pref"

const STALE_MS = 20 * 60 * 60 * 1000

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return true
  }
}

/** The score counts up the first time a card shows (skipped for reduced motion). */
function CountUp({ to, ms = 600 }: { to: number; ms?: number }) {
  const [n, setN] = useState(to)
  useEffect(() => {
    if (prefersReducedMotion() || to <= 0) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restarts the requestAnimationFrame count-up
    setN(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return <>{n}</>
}

/** Where the match is now and where tailoring can take it. */
/** A short tape measure: the solid fill is the match now, the basting stitch is where a tailor takes it. */
function ReachBar({ score, reach }: { score: number; reach: number }) {
  return <TapeMeasure value={score} reach={reach} size="sm" className="w-24 pt-1" />
}

// The search is one request, so the steps follow the clock (about where the server is), and
// the last one stays open until the results land.
const SEARCH_STAGES = [
  { id: "boards", label: "Searching job boards at companies like Target, 3M and Stripe", at: 0 },
  { id: "titles", label: "Picking the jobs that fit what you want next", at: 8_000 },
  { id: "reading", label: "Reading the top jobs and checking your real match", at: 12_000 },
  { id: "ranking", label: "Ranking them, best match first", at: 30_000 },
]

function useSearchStage(running: boolean): string | null {
  const [stage, setStage] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the stage follows a timer while the search runs
    if (!running) return setStage(null)
    const started = Date.now()
    const tick = () => {
      const t = Date.now() - started
      setStage([...SEARCH_STAGES].reverse().find((s) => t >= s.at)!.id)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [running])
  return stage
}

const WORKPLACE_OPTIONS: { id: Workplace; label: string }[] = [
  { id: "both", label: "Remote or near me" },
  { id: "remote", label: "Remote" },
  { id: "near", label: "Near me" },
]

function placeLabel(workplace: Workplace, home: string): string {
  // No US state on the resume: the search can only show remote jobs, so say that.
  if (!usState(home)) return "Remote"
  const near = `near ${home}`
  return workplace === "remote" ? "Remote" : workplace === "near" ? near : `Remote or ${near}`
}


/** Hidden by "possible sponsors only": the post rules it out, or the employer has no H-1B record. */
export function rulesOutSponsor(m: Pick<FeedMatchDTO, "visa">): boolean {
  if (!m.visa) return false
  if (m.visa.post === "no") return true
  if (m.visa.post === "yes") return false
  return m.visa.h1b?.approvals === 0
}

/** "FY2021-FY2023" -> "FY21-23". */
const shortYears = (y: string) => y.replace(/FY20(\d\d)-FY20(\d\d)/, "FY$1-$2").replace(/^FY20(\d\d)$/, "FY$1")

function VisaLine({ visa }: { visa: NonNullable<FeedMatchDTO["visa"]> }) {
  const parts: ReactNode[] = []
  if (visa.post === "no") parts.push(<span key="p" className="font-medium text-warn">The post says no visa sponsorship</span>)
  if (visa.post === "yes") parts.push(<span key="p" className="font-medium text-success">The post offers visa sponsorship</span>)
  if (visa.h1b && visa.h1b.approvals > 0)
    parts.push(
      <span key="h" title={`From USCIS's public H-1B data: workers this employer got approved, ${visa.h1b.years}. Past filings, not a promise that this job sponsors.`}>
        H-1B: {visa.h1b.approvals.toLocaleString("en-US")} approved ({shortYears(visa.h1b.years)})
      </span>
    )
  else if (visa.h1b && visa.post !== "yes")
    parts.push(
      <span key="h" title="None in USCIS's H-1B data under this name. Some companies file under a different legal name, so check before you rule it out.">
        No H-1B record found
      </span>
    )
  if (!parts.length) return null
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-muted">
      {parts.flatMap((p, i) => (i ? [<span key={`d${i}`} aria-hidden>·</span>, p] : [p]))}
    </p>
  )
}

const TITLE_FIT = { close: "Title matches", partly: "Title partly matches", different: "Different title" } as const

/** Why it's a match, in one line: title, skills, level. */
function MatchWhyLine({ why }: { why: NonNullable<FeedMatchDTO["why"]> }) {
  const { title, skills, level } = why
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-muted">
      <span title={title.wanted ? `Compared with ${title.wanted}` : undefined}>{TITLE_FIT[title.fit]}</span>
      {skills.of > 0 && (
        <>
          <span aria-hidden>·</span>
          <span title="The job's key skills your resume shows in its words, and in other words">
            {skills.have} of {skills.of} key skills{skills.other > 0 ? `, ${skills.other} more in other words` : ""}
          </span>
        </>
      )}
      <span aria-hidden>·</span>
      <span className={level.fits ? undefined : "font-medium text-warn"}>{level.note}</span>
    </p>
  )
}

function scoreTone(score: number): string {
  if (score >= 45) return "bg-success-tint text-text"
  if (score >= 25) return "bg-surface-raised text-text"
  return "bg-surface-raised text-text-muted"
}

export function MatchesPanel({
  resumeId,
  home,
  compact = false,
  onPick,
  onUpgrade,
  onSeeAll,
}: {
  resumeId: string
  /** The resume's own location ("Saint Paul, MN"), for "near me". */
  home: string
  /** Home: the top 3, no question form (it links to the Job card instead). */
  compact?: boolean
  onPick: (job: JobDraft) => void
  onUpgrade: (reason?: string) => void
  onSeeAll?: () => void
}) {
  const [feed, setFeed] = useState<FeedDTO | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [asking, setAsking] = useState(false)
  const [title, setTitle] = useState("")
  const [workplace, setWorkplace] = useState<Workplace>("both")
  const [running, setRunning] = useState(false)
  const searchStage = useSearchStage(running)
  const [error, setError] = useState("")
  const [opening, setOpening] = useState<string | null>(null)
  const refreshed = useRef<string | null>(null)
  const [needsVisa, setNeedsVisa] = useState(false)
  const [sponsorOnly, setSponsorOnly] = useState(false)
  useEffect(() => {
    const sync = () => {
      setNeedsVisa(readFlag(VISA_KEY))
      setSponsorOnly(readFlag(VISA_ONLY_KEY))
    }
    sync()
    window.addEventListener(VISA_EVENT, sync)
    return () => window.removeEventListener(VISA_EVENT, sync)
  }, [])
  const changeSponsorOnly = (on: boolean) => {
    setSponsorOnly(on)
    writeFlag(VISA_ONLY_KEY, on)
  }

  const run = useCallback(
    async (titles: string[], place: Workplace, quiet = false) => {
      setRunning(true)
      setError("")
      const r = await findMatches(resumeId, { targetTitles: titles, workplace: place })
      setRunning(false)
      if (r.ok) {
        setFeed(r)
        setAsking(false)
      } else {
        if (r.matches) setFeed((f) => ({ ...(f as FeedDTO), ...(r as Partial<FeedDTO>) }) as FeedDTO)
        if (!quiet) setError(r.error)
      }
    },
    [resumeId]
  )

  // A different resume (or layout) starts from an empty feed while it loads.
  const feedKey = `${resumeId}|${compact}`
  const [syncedFeedKey, setSyncedFeedKey] = useState(feedKey)
  if (feedKey !== syncedFeedKey) {
    setSyncedFeedKey(feedKey)
    setFeed(null)
    setLoadFailed(false)
  }

  useEffect(() => {
    let live = true
    void loadFeed(resumeId).then((r) => {
      if (!live) return
      if (!r.ok) return setLoadFailed(true)
      setFeed(r)
      setTitle(r.prefs?.targetTitles[0] ?? r.suggestedTitles[0] ?? "")
      setWorkplace(r.prefs?.workplace ?? "both")
      setAsking(!r.prefs)
      // Answered before, but the list is a day old: refresh it quietly (new jobs every morning).
      const stale = r.prefs && (!r.matchedAt || Date.now() - Date.parse(r.matchedAt) > STALE_MS)
      if (stale && !compact && refreshed.current !== resumeId) {
        refreshed.current = resumeId
        void run(r.prefs!.targetTitles, r.prefs!.workplace, true)
      }
    })
    return () => {
      live = false
    }
  }, [resumeId, compact, run])

  if (loadFailed || feed?.unavailable) return null
  if (!feed) {
    return compact ? null : (
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Looking for your matches...
      </p>
    )
  }

  const pick = async (m: FeedMatchDTO) => {
    setOpening(m.id)
    const r = await openMatch(m.id)
    setOpening(null)
    if (!r.ok) return toast.error(r.error)
    if (r.job.closed) toast.message("Heads up: this job just closed on the company's site.")
    onPick(r.job)
  }

  const toggleSave = async (m: FeedMatchDTO) => {
    const saved = !m.savedAt
    setFeed((f) => f && { ...f, matches: f.matches.map((x) => (x.id === m.id ? { ...x, savedAt: saved ? new Date().toISOString() : null } : x)) })
    const r = await markMatch(m.id, saved ? "save" : "unsave")
    if (!r.ok) toast.error(r.error)
    else if (saved) toast.success(r.tracked === false ? "Saved here. Your tracker is full, so it isn't there." : "Saved to your tracker.")
  }

  const dismiss = async (m: FeedMatchDTO) => {
    setFeed((f) => f && { ...f, matches: f.matches.filter((x) => x.id !== m.id), total: Math.max(0, f.total - 1) })
    const r = await markMatch(m.id, "dismiss")
    if (!r.ok) toast.error(r.error)
  }

  // ---------- the one question ----------
  if (asking && !compact) {
    return (
      <section className="space-y-3 rounded-card border border-border bg-surface-raised p-4" aria-label="Find jobs that match you">
        <div>
          <p className="flex items-center gap-2 font-semibold text-text">
            <Search className="h-4 w-4" aria-hidden /> Find jobs that match your resume
          </p>
          <p className="mt-1 text-sm text-text-muted">We check thousands of open jobs at real companies and rank them by your actual match. Switching careers? Type the job you want next.</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">What job do you want next?</span>
          <input
            className={inputClass}
            value={title}
            maxLength={80}
            placeholder="e.g. Operations Coordinator"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && title.trim() && void run([title.trim()], workplace)}
          />
        </label>
        <Segmented label="Where" value={workplace} onChange={setWorkplace} options={WORKPLACE_OPTIONS} className="w-full sm:w-auto" />
        {workplace !== "remote" && !usState(home) && (
          <p className="text-xs text-text-muted">
            Your resume doesn&apos;t say which US city and state you&apos;re in, so we&apos;ll show remote jobs. Add your city and state on the Resume card to see jobs near you too.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void run([title.trim()], workplace)} loading={running} disabled={!title.trim()}>
            {!running && <Sparkles className="h-4 w-4" />} {running ? "Searching" : "Find my matches"}
          </Button>
          {feed.prefs && (
            <Button variant="text" onClick={() => setAsking(false)} disabled={running}>
              Cancel
            </Button>
          )}
        </div>
        {running && (
          <div className="space-y-2">
            <StageList stages={SEARCH_STAGES} current={searchStage} />
            <p className="text-xs text-text-muted">Thousands of open jobs. This takes under a minute.</p>
          </div>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </section>
    )
  }
  if (compact && !feed.prefs) return null

  // ---------- the list ----------
  const visible = needsVisa && sponsorOnly ? feed.matches.filter((m) => !rulesOutSponsor(m)) : feed.matches
  const shown = compact ? visible.slice(0, 3) : visible
  const visaHidden = feed.matches.length - visible.length
  const hidden = feed.total - feed.matches.length
  const looking = feed.prefs ? `${feed.prefs.targetTitles.join(", ") || "Your kind of job"} · ${placeLabel(feed.prefs.workplace, home)}` : ""

  return (
    <section className="space-y-3" aria-label="Top matches for you">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text">Top matches for you</h3>
          <p className="truncate text-xs text-text-muted">{looking}</p>
        </div>
        {!compact && (
          <span className="flex shrink-0 gap-1">
            <Button variant="text" size="sm" onClick={() => setAsking(true)} disabled={running}>
              Change
            </Button>
            <Button variant="text" size="sm" onClick={() => feed.prefs && void run(feed.prefs.targetTitles, feed.prefs.workplace)} loading={running} aria-label="Look again">
              {!running && <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </span>
        )}
      </div>
      {!compact && needsVisa && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
          <label className="flex items-center gap-1.5" title="Hides jobs whose post rules sponsorship out, and employers with no H-1B approvals on record">
            <input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--text))]" checked={sponsorOnly} onChange={(e) => changeSponsorOnly(e.currentTarget.checked)} />
            Possible sponsors only{sponsorOnly && visaHidden > 0 ? ` (${visaHidden} hidden)` : ""}
          </label>
        </div>
      )}
      {running && !compact && (
        <p className="flex items-center gap-2 text-xs text-text-muted" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for new jobs...
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}

      {shown.length === 0 ? (
        !running && visaHidden > 0 ? (
          <div className="rounded-card border border-dashed border-border p-4 text-sm text-text-muted">
            <p className="font-medium text-text">All {visaHidden} matches are hidden by &ldquo;Possible sponsors only&rdquo;.</p>
            <p className="mt-1">Their posts rule sponsorship out, or their employers have no H-1B approvals on record. Try a broader title, or turn the filter off to see them.</p>
          </div>
        ) : !running && (
          <div className="rounded-card border border-dashed border-border p-4 text-sm text-text-muted">
            <p className="font-medium text-text">Nothing good yet.</p>
            <p className="mt-1">
              {feed.prefs?.workplace === "near" ? "Try including remote jobs, or a" : "Try a"} broader, more common title (&ldquo;Operations Coordinator&rdquo; rather than a team name), or paste a job you found below. New jobs come in every morning.
            </p>
          </div>
        )
      ) : (
        <ul className="space-y-2">
          {shown.map((m, i) => (
            <li
              key={m.id}
              className="rounded-card border border-border p-3 transition-colors hover:border-text/25 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:fill-mode-both"
              style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", scoreTone(m.score))} title="Your match: the share of this job's key skills your resume already shows">
                  <CountUp to={m.score} />%
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-text">
                    {m.job.title}
                    {m.isNew && <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-accent-strong">New</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
                    <span className="font-medium text-text-secondary">{m.job.company}</span>
                    {m.job.via === 'Adzuna' && (
                      <a
                        href={ADZUNA_HOME}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center rounded border border-border px-1.5 font-medium text-text-secondary underline-offset-2 hover:underline"
                        style={{ minWidth: ADZUNA_LABEL_MIN.width, minHeight: ADZUNA_LABEL_MIN.height }}
                      >
                        {ADZUNA_LABEL}
                      </a>
                    )}
                    {m.job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden /> {m.job.location.length > 60 ? `${m.job.location.slice(0, 57)}...` : m.job.location}
                      </span>
                    )}
                    {m.job.payLabel && (
                      <span className="flex items-center gap-1">
                        <Banknote className="h-3 w-3" aria-hidden /> {m.job.payLabel}
                      </span>
                    )}
                    {matchAgeNote(m.job.postedAt) && (
                      <span className="flex items-center gap-1" title="Older ads are more often filled, paused or left up by mistake. Worth applying soon or checking it's still open.">
                        <Clock className="h-3 w-3" aria-hidden /> {matchAgeNote(m.job.postedAt)}
                      </span>
                    )}
                  </p>
                  {!compact && needsVisa && m.visa && <VisaLine visa={m.visa} />}
                  {!compact && m.why && <MatchWhyLine why={m.why} />}
                  {m.reach >= m.score + 5 && (
                    <p className="mt-1 flex items-center gap-2 text-xs font-medium text-success" title="Your resume already shows more of this job's skills in other words. Tailoring puts them in the job's words.">
                      <ReachBar score={m.score} reach={m.reach} />
                      A tailor takes this to {m.reach}%
                    </p>
                  )}
                  {!compact && m.missing.length > 0 && <p className="mt-1 text-xs text-text-muted">Missing: {m.missing.slice(0, 4).map(skillLabel).join(", ")}</p>}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <Button size="sm" onClick={() => void pick(m)} loading={opening === m.id} disabled={!!opening}>
                  {m.applicationId ? "Tailor again" : "Tailor"}
                </Button>
                {!compact && (
                  <>
                    <Button size="sm" variant="text" onClick={() => void toggleSave(m)} aria-label={m.savedAt ? "Unsave" : "Save"} title={m.savedAt ? "Saved" : "Save for later"}>
                      {m.savedAt ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="text" className="ml-auto" onClick={() => void dismiss(m)} title="Not for me: hide it">
                      <X className="h-3.5 w-3.5" /> Not for me
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {compact && feed.total > shown.length && onSeeAll && (
        <Button variant="text" size="sm" onClick={onSeeAll}>
          See all {feed.isPro ? feed.total : Math.min(feed.total, feed.limit)} matches
        </Button>
      )}
      {!compact && !feed.isPro && hidden > 0 && (
        <button
          type="button"
          onClick={() => onUpgrade(`Free accounts see their top ${feed.limit} matches. Pro shows every job that fits, ranked by your real match.`)}
          className="w-full rounded-card border border-dashed border-border p-3 text-sm font-medium text-text-secondary hover:text-text"
        >
          {hidden} more {hidden === 1 ? "match" : "matches"} with Pro
        </button>
      )}
      {!compact && <SkillDemandCard resumeId={resumeId} matches={visible} />}
    </section>
  )
}
