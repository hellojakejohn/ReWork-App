// The free "Is this job real?" check at /check: scam signs, ghost-job signs, and whether
// the job is still open on the employer's own board (from our daily pull). No AI call, no
// account, nothing saved. Facts with a short why, never a verdict.
import { ghostSignals, readPastedJob, scamSignals, type GhostSignal, type JobFacts, type ScamSignal } from '@/lib/job-checks'
import { resolveJob, type ResolveDeps } from '@/lib/job-resolve'
import { matchAtsUrl } from '@/lib/job-resolve/ats'

export interface BoardStatus {
  /** We pull this employer's board daily and know this exact job. */
  known: boolean
  open: boolean
  firstSeenAt: string | null
  closedAt: string | null
  /** Other open jobs at this employer in our feed. */
  companyOpenJobs: number
}

export interface JobCheckResult {
  job: { title: string; company: string; location: string }
  scam: ScamSignal[]
  ghost: GhostSignal[]
  /** Checks that came back fine, so a clean result still says what was looked at. */
  fine: string[]
  board: BoardStatus | null
  fromLink: boolean
}

export type JobCheckOutcome = { ok: true; result: JobCheckResult } | { ok: false; error: string; needsPaste?: boolean }

export interface JobCheckDeps {
  fetchPage: ResolveDeps['fetchPage']
  /** Our jobs table, by source and the board's own job id. Null when we don't have it. */
  findBoardJob?: (source: string, jobId: string) => Promise<{ company: string; firstSeenAt: Date; closedAt: Date | null } | null>
  countCompanyOpen?: (company: string) => Promise<number>
  now?: Date
}

const PASTE_HINT = 'Copy the whole job post (title, duties, requirements) and paste it here instead.'

export async function checkJob(raw: string, deps: JobCheckDeps): Promise<JobCheckOutcome> {
  const now = deps.now ?? new Date()
  const pasted = readPastedJob(raw)
  if (pasted.kind === 'unclear') return { ok: false, error: 'Paste one job link, or the whole job post.' }

  let job: { title: string; company: string; location: string; description: string; facts?: JobFacts }
  let url: string | null = null
  if (pasted.kind === 'link') {
    url = pasted.url
    const resolved = await resolveJob(pasted.url, { fetchPage: deps.fetchPage }).catch(() => null)
    if (!resolved) return { ok: false, needsPaste: true, error: `We couldn't open that link. ${PASTE_HINT}` }
    if (!resolved.ok) return { ok: false, needsPaste: true, error: `${resolved.message} ${PASTE_HINT}`.replace(/\s+/g, ' ').trim() }
    job = resolved.job
  } else {
    job = { title: pasted.title, company: pasted.company, location: '', description: pasted.description, facts: pasted.facts }
  }

  // Is it still up on the employer's own board? Only for boards we pull daily.
  let board: BoardStatus | null = null
  const ats = url ? matchAtsUrl(url) : null
  if (ats && deps.findBoardJob) {
    const row = await deps.findBoardJob(ats.ats, ats.jobId).catch(() => null)
    if (row) {
      board = {
        known: true,
        open: !row.closedAt,
        firstSeenAt: row.firstSeenAt.toISOString(),
        closedAt: row.closedAt?.toISOString() ?? null,
        companyOpenJobs: deps.countCompanyOpen ? await deps.countCompanyOpen(row.company).catch(() => 0) : 0,
      }
    }
  }

  const scam = scamSignals(job.description)
  const ghost = ghostSignals(job.description, job.facts ?? {}, now)
  if (board?.closedAt && !ghost.some((g) => g.id === 'closed')) {
    const day = new Date(board.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    ghost.unshift({ id: 'closed', label: `It came off the employer's own job board on ${day}. It's likely filled or paused, even if other sites still show it.` })
  }

  const fine: string[] = []
  if (scam.length === 0) fine.push('No asks for money, ID, bank details, crypto, chat apps or code tests up front.')
  if (!ghost.some((g) => g.id === 'no_pay') && job.description.trim().length >= 200) fine.push('Pay is listed.')
  if (!ghost.some((g) => g.id === 'agency' || g.id === 'pipeline')) fine.push('It reads like a real opening at the employer, not an agency or a "talent pool".')
  if (job.facts?.posted && !ghost.some((g) => g.id === 'old' || g.id === 'reposted')) fine.push('It was posted recently.')
  if (board?.open) fine.push("It's still open on the employer's own job board (we check it every morning).")
  if (ats && !board) fine.push(`The link goes to the employer's own hiring system (${ats.ats[0].toUpperCase()}${ats.ats.slice(1)}), not a reposting site.`)

  return {
    ok: true,
    result: {
      job: { title: job.title || 'This job', company: job.company, location: job.location },
      scam,
      ghost,
      fine,
      board,
      fromLink: pasted.kind === 'link',
    },
  }
}
