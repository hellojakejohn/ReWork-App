// Share cards: a link anyone can post (rework.careers/s?...) whose preview image shows a
// fit check or a tailor's result. Only numbers go in the link: never a name, job, company
// or resume text. Pure and client-safe.

export type ShareCard =
  | { kind: 'fit'; score: number; fits: number; otherWords: number; alterations: number }
  | { kind: 'tailor'; before: number; after: number; kept: number }

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
  } else {
    q.set('k', 'tailor')
    q.set('b', String(card.before))
    q.set('a', String(card.after))
    q.set('n', String(card.kept))
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
  return `Tailored my resume for a job: ${card.before}% to ${card.after}% match, and nothing made up.`
}

/** Headline for the card and the /s page. */
export function shareHeadline(card: ShareCard): string {
  if (card.kind === 'fit') return `A ${card.score}% fit, measured.`
  return `${card.before}% to ${card.after}%, honestly.`
}
