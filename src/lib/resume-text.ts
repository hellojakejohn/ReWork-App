// Plain-text helpers shared by fact-guard and keyword coverage. No AI, no I/O.
import type { TailorInput, TailorOutput } from '@/types/tailor'

export function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Case-insensitive "whole term" match. Boundaries are any non-alphanumeric char, so
 * "React" doesn't match "Reactive" but "Node.js", "C#" and "CI/CD" still work.
 */
export function containsTerm(haystack: string, term: string): boolean {
  const needle = normalizeSpace(term).toLowerCase()
  if (!needle) return false
  const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(needle)}(?![a-z0-9])`, 'i')
  return pattern.test(normalizeSpace(haystack).toLowerCase())
}

const MULTIPLIERS: Record<string, number> = { k: 1e3, m: 1e6, mm: 1e6, b: 1e9, bn: 1e9 }

// $ is optional, digits may have thousands separators/decimals, then an optional
// %, magnitude (k/m/b) or "x" suffix. Digits glued to a preceding letter (EC2, S3,
// Web3, OAuth2) are product names, not metrics, so they're skipped.
const NUMBER_RE = /(?<![A-Za-z0-9.])(\$\s?)?(\d+(?:,\d{3})*(?:\.\d+)?)(\s?%|(?:k|mm|m|bn|b|x)(?![A-Za-z]))?/gi

/**
 * Pull numeric tokens out of text, normalized so "$1.2M" and "$1,200,000" compare equal.
 * Percent and multiplier ("3x") markers are part of the token: "50%" is a different claim
 * than "50 people". Dollar signs are ignored.
 */
export function extractNumberTokens(text: string): string[] {
  // Collapse dates to their year first, otherwise "2021-05" would whitelist "5".
  const withoutMonths = text
    .replace(/\b((?:19|20)\d{2})[-/.](?:0?[1-9]|1[0-2])\b/g, '$1')
    .replace(/\b(?:0?[1-9]|1[0-2])[-/]((?:19|20)\d{2})\b/g, '$1')
  const tokens: string[] = []
  for (const match of withoutMonths.matchAll(NUMBER_RE)) {
    const raw = match[2].replace(/,/g, '')
    const suffix = (match[3] || '').trim().toLowerCase()
    let value = parseFloat(raw)
    if (Number.isNaN(value)) continue
    let marker = ''
    if (suffix === '%') marker = '%'
    else if (suffix === 'x') marker = 'x'
    else if (suffix in MULTIPLIERS) value = value * MULTIPLIERS[suffix]
    tokens.push(`${Number(value.toPrecision(12))}${marker}`)
  }
  return tokens
}

/** Every string in the master resume we send to the model, flattened. */
export function tailorInputText(input: TailorInput): string {
  const parts: string[] = [input.summary, ...input.skills]
  for (const role of input.roles) {
    parts.push(role.title, role.company, role.startDate, role.endDate, role.location, ...role.bullets)
  }
  for (const edu of input.education) {
    parts.push(edu.degree, edu.field, edu.institution, edu.graduationYear, ...edu.details)
  }
  for (const project of input.projects) {
    parts.push(project.name, project.description, ...project.technologies, ...project.bullets)
  }
  return parts.filter(Boolean).join('\n')
}

/** Resume text for a tailored version (what a recruiter/ATS would read). */
export function tailorOutputText(output: TailorOutput, master: TailorInput): string {
  const parts: string[] = [output.summary, ...output.skills]
  for (const role of output.roles) {
    parts.push(role.title, role.company, ...role.bullets.map((b) => b.text))
  }
  for (const edu of master.education) {
    parts.push(edu.degree, edu.field, edu.institution, ...edu.details)
  }
  const masterProjects = new Map(master.projects.map((p) => [p.id, p]))
  for (const project of output.projects) {
    parts.push(project.name, project.description, ...project.bullets.map((b) => b.text))
    parts.push(...(masterProjects.get(project.id)?.technologies ?? []))
  }
  return parts.filter(Boolean).join('\n')
}
