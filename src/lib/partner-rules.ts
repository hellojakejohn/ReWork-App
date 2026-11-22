// Partner codes, pure (src/lib/partners.ts does the database work).
// A workforce center, college or coach who says yes gets a link like
// rework.careers/?ref=careerforce-stp. Anyone who signs up through it gets `days` of Pro
// (a COMP entitlement), up to `cap` signups per code, until `until` if set. The code rides
// on the existing source cookie (src/lib/signup-source.ts), so /admin already shows
// signups, tailors and payers per partner.
//
// The list is public (this repo is), so every code has a cap. Add a code only once the
// partner has said yes (docs/marketing/partners.md).

export interface Partner {
  /** Shown to the person: "Your free month from {name}". */
  name: string
  days: number
  /** Most signups that get the days. */
  cap: number
  /** Last day the code gives days, YYYY-MM-DD (UTC). */
  until?: string
}

export const PARTNERS: Record<string, Partner> = {
  // 'careerforce-stp': { name: 'CareerForce Saint Paul', days: 30, cap: 100, until: '2027-03-31' },
}

/** The partner for a ?ref= tag (already cleaned to lowercase), if it's one of ours. */
export function partnerFor(code: string | null | undefined, list: Record<string, Partner> = PARTNERS): (Partner & { code: string }) | null {
  if (!code || !Object.prototype.hasOwnProperty.call(list, code)) return null
  return { ...list[code], code }
}

/** Why this signup gets no days, or null when it does. */
export function partnerBlock(p: Partner, claimed: number, now: Date): 'cap' | 'ended' | null {
  if (p.until && now.toISOString().slice(0, 10) > p.until) return 'ended'
  if (claimed >= p.cap) return 'cap'
  return null
}

export function partnerLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}`
}
