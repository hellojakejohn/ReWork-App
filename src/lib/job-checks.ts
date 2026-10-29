// Small, pure checks on a job: tidy its title and spot a description written for a
// different company (a job board reposting someone else's ad). Shared by the resolver and
// the Job card, so pasted jobs get the same checks as links.

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Same company, ignoring case, punctuation and suffixes ("Acme" vs "Acme, Inc."). */
export function sameCompany(a: string, b: string): boolean {
  const x = norm(a.replace(/\b(inc|llc|ltd|corp|co|gmbh|plc)\b\.?/gi, ''))
  const y = norm(b.replace(/\b(inc|llc|ltd|corp|co|gmbh|plc)\b\.?/gi, ''))
  if (!x || !y) return false
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)))
}

/** "Senior Designer - Acme" with company "Acme" -> "Senior Designer". Also "|", "at", "@". */
export function cleanJobTitle(title: string, company: string): string {
  const t = title.trim()
  if (!company.trim()) return t
  const m = t.match(/^(.+?)\s*(?:[-–—|·:@]|\bat\b)\s*([^-–—|·:@]+)$/i)
  if (m && m[1].trim().length >= 3 && sameCompany(m[2], company)) return m[1].trim()
  return t
}

// Phrases an ad uses to name its own company: "As a Designer at Coinglass", "About
// Coinglass", "Join Coinglass", "Coinglass is a ...", "at Coinglass, you".
const NAME = String.raw`([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,2})`
const SELF_NAMING = [
  new RegExp(String.raw`\b(?:[Aa]t|[Jj]oin|[Jj]oining|[Aa]bout)\s+${NAME}`, 'g'),
  new RegExp(String.raw`(?:^|[.\n]\s*)${NAME}\s+(?:is|was|builds|helps|provides|offers)\s+(?:a|an|the|one)\b`, 'g'),
]
const NOT_A_NAME = /^(the|our|this|us|you|we|a|an|least|all|scale|home|work|any|role|job|position|team|every|times?|first|last)$/i

/**
 * The company a description names itself as, when that is not `company` and it does so at
 * least twice. Null when it agrees, or when there is no clear signal.
 */
export function otherCompanyNamed(description: string, company: string): string | null {
  if (!company.trim() || !description.trim()) return null
  const counts = new Map<string, { name: string; n: number }>()
  for (const re of SELF_NAMING) {
    for (const m of description.matchAll(re)) {
      const name = m[1].trim().replace(/[.']+$/, '')
      if (NOT_A_NAME.test(name.split(/\s+/)[0])) continue
      if (sameCompany(name, company)) return null
      const key = norm(name)
      const c = counts.get(key) || { name, n: 0 }
      c.n += 1
      counts.set(key, c)
    }
  }
  // The other name should also show up as a plain word more than once overall.
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0]
  if (!best) return null
  const mentions = description.split(best.name).length - 1
  const companyMentions = description.toLowerCase().split(company.toLowerCase()).length - 1
  return best.n >= 2 && mentions >= 2 && companyMentions === 0 ? best.name : null
}
