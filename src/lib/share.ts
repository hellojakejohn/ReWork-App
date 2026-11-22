// Share cards: a link anyone can post (rework.careers/s?...) whose preview image shows a
// fit check or a tailor's result. Only numbers go in the link: never a name, job, company
// or resume text. Pure and client-safe.

export type ShareCard =
  | { kind: 'fit'; score: number; fits: number; otherWords: number; alterations: number }
  | { kind: 'tailor'; before: number; after: number; kept: number }
  /** A tracker milestone: their nth interview or offer, with the running counts. */
  | { kind: 'milestone'; stage: 'interview' | 'offer'; nth: number; applied: number; interviews: number; offers: number }

const int = (v: string | null | undefined, max: number): number | null => {
  if (v == null || !/^\d{1,4}$/.test(v)) return null
  const n = Number(v)
  return n >= 0 && n <= max ? n : null
}

/** Reads a card from query params; null if anything is missing or out of range. */
export function parseShare(params: { get(name: string): string | null }): ShareCard | null {
  const kind = params.get('k')
  if (kind === 'fit') {
    const score = int(params.get('s'), 100)
    const fits = int(params.get('f'), 99)
    const otherWords = int(params.get('o'), 99)
    const alterations = int(params.get('m'), 99)
    if (score === null || fits === null || otherWords === null || alterations === null) return null
    return { kind, score, fits, otherWords, alterations }
  }
  if (kind === 'tailor') {
    const before = int(params.get('b'), 100)
    const after = int(params.get('a'), 100)
    const kept = int(params.get('n'), 999)
    if (before === null || after === null || kept === null) return null
    return { kind, before, after, kept }
  }
  if (kind === 'ms') {
    const st = params.get('st')
    const nth = int(params.get('x'), 999)
    const applied = int(params.get('p'), 9999)
    const interviews = int(params.get('iv'), 999)
    const offers = int(params.get('of'), 99)
    if ((st !== 'i' && st !== 'o') || !nth || applied === null || interviews === null || offers === null) return null
    return { kind: 'milestone', stage: st === 'i' ? 'interview' : 'offer', nth, applied, interviews, offers }
  }
  return null
}

export function shareQuery(card: ShareCard): string {
  const q = new URLSearchParams()
  if (card.kind === 'fit') {
    q.set('k', 'fit')
    q.set('s', String(card.score))
    q.set('f', String(card.fits))
    q.set('o', String(card.otherWords))
    q.set('m', String(card.alterations))
  } else if (card.kind === 'tailor') {
    q.set('k', 'tailor')
    q.set('b', String(card.before))
    q.set('a', String(card.after))
    q.set('n', String(card.kept))
  } else {
    q.set('k', 'ms')
    q.set('st', card.stage === 'interview' ? 'i' : 'o')
    q.set('x', String(card.nth))
    q.set('p', String(card.applied))
    q.set('iv', String(card.interviews))
    q.set('of', String(card.offers))
  }
  return q.toString()
}

/** The link to post. `ref=share` lets /admin count signups from shared cards. */
export function shareUrl(origin: string, card: ShareCard): string {
  return `${origin.replace(/\/$/, '')}/s?${shareQuery(card)}&ref=share`
}

export function shareImagePath(card: ShareCard): string {
  return `/api/og/share?${shareQuery(card)}`
}

/** The words that go with the link when it's posted. */
export function shareText(card: ShareCard): string {
  if (card.kind === 'fit') return `I took my resume's measurements for a job: ${card.score}% fit. Check yours free, no sign-up.`
  if (card.kind === 'tailor') return `Tailored my resume for a job: ${card.before}% to ${card.after}% match, and nothing made up.`
  if (card.stage === 'offer') return `Got an offer! Every resume I sent was tailored to the job, and nothing was made up.`
  return card.nth === 1 ? `Landed my first interview. Tailored resume, nothing made up.` : `Interview number ${card.nth}. Tailored resumes, nothing made up.`
}

/** The line under the headline: plain words, real counts. */
export function shareDetail(card: ShareCard): string {
  if (card.kind === 'fit') {
    const asked = card.fits + card.otherWords + card.alterations
    const shows = card.fits + card.otherWords
    return `The resume already shows ${shows} of the ${asked} skills this job asks for. ${card.alterations} to add or prove.`
  }
  if (card.kind === 'tailor') return `${card.kept} ${card.kept === 1 ? 'line' : 'lines'} rewritten for the job, each checked against the real resume. Nothing made up.`
  return `After ${card.applied} ${card.applied === 1 ? 'application' : 'applications'}, each resume tailored to the job. Nothing made up.`
}

/** Headline for the card and the /s page. */
export function shareHeadline(card: ShareCard): string {
  if (card.kind === 'fit') return `A ${card.score}% fit, measured.`
  if (card.kind === 'tailor') return `${card.before}% to ${card.after}%, honestly.`
  if (card.stage === 'offer') return card.nth === 1 ? 'An offer.' : `Offer number ${card.nth}.`
  return card.nth === 1 ? 'First interview.' : `Interview number ${card.nth}.`
}
