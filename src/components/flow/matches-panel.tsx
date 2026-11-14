"use client"

// Matches on upload: "What job do you want next?" once, then the open jobs that fit this
// resume, best real match first. Tailor fills the Job card with the full post: no link to
// paste. Shown on the Job card (the step right after the upload) and, shorter, on Home.
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Banknote, Bookmark, BookmarkCheck, Loader2, MapPin, RefreshCw, Search, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { cn } from "@/lib/utils"
import { findMatches, loadFeed, markMatch, openMatch, type FeedDTO, type FeedMatchDTO, type JobDraft, type Workplace } from "./api"
import { ErrorNote, inputClass } from "./ui"

const STALE_MS = 20 * 60 * 60 * 1000

const WORKPLACE_OPTIONS: { id: Workplace; label: string }[] = [
  { id: "both", label: "Remote or near me" },
  { id: "remote", label: "Remote" },
  { id: "near", label: "Near me" },
]

function placeLabel(workplace: Workplace, home: string): string {
  const near = home ? `near ${home}` : "near you"
  return workplace === "remote" ? "Remote" : workplace === "near" ? near : `Remote or ${near}`
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
  const [error, setError] = useState("")
  const [opening, setOpening] = useState<string | null>(null)
  const refreshed = useRef<string | null>(null)

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

  useEffect(() => {
    let live = true
    setFeed(null)
    setLoadFailed(false)
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
        {running && <p className="text-xs text-text-muted" aria-live="polite">Checking thousands of jobs at companies like Target, 3M, Stripe and Medtronic. The first search takes up to a minute.</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
      </section>
    )
  }
  if (compact && !feed.prefs) return null

  // ---------- the list ----------
  const shown = compact ? feed.matches.slice(0, 3) : feed.matches
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
      {running && !compact && (
        <p className="flex items-center gap-2 text-xs text-text-muted" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for new jobs...
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}

      {shown.length === 0 ? (
        !running && (
          <div className="rounded-card border border-dashed border-border p-4 text-sm text-text-muted">
            <p className="font-medium text-text">Nothing good yet.</p>
            <p className="mt-1">
              {feed.prefs?.workplace === "near" ? "Try including remote jobs, or a" : "Try a"} broader, more common title (&ldquo;Operations Coordinator&rdquo; rather than a team name), or paste a job you found below. New jobs come in every morning.
            </p>
          </div>
        )
      ) : (
        <ul className="space-y-2">
          {shown.map((m) => (
            <li key={m.id} className="rounded-card border border-border p-3">
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", scoreTone(m.score))} title="Your match: the share of this job's key skills your resume already shows">
                  {m.score}%
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-text">
                    {m.job.title}
                    {m.isNew && <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-accent-strong">New</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
                    <span className="font-medium text-text-secondary">{m.job.company}</span>
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
                  </p>
                  {m.reach >= m.score + 5 && (
                    <p className="mt-1 text-xs font-medium text-success" title="Your resume already shows more of this job's skills in other words. Tailoring puts them in the job's words.">
                      Tailoring can lift this to {m.reach}%
                    </p>
                  )}
                  {!compact && m.missing.length > 0 && <p className="mt-1 text-xs text-text-muted">Missing: {m.missing.slice(0, 4).join(", ")}</p>}
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
    </section>
  )
}
