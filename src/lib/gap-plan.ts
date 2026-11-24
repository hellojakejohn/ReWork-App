// Close the gap: for a skill a job asks for and the resume doesn't show, what it would take
// to really have it. A rough time, what to learn, one small thing to build as proof, and how
// it reads on a resume once done. Nothing is added to the resume here: when they've done it,
// the skill check's "Yes" adds exactly what they say (src/lib/skill-check.ts).
//
// Only the skill name goes to the model (never resume text), so one plan per skill is cached
// for everyone in `skill_gaps`. Course links are search links built here, never written by
// the model; a partner's link is wrapped with its affiliate template when one is set.
import { AIOutputError, classifyAIError } from '@/lib/ai-errors'
import { callOverrides, generateStructured, type AICallOptions } from '@/lib/ai'

export const GAP_MODEL = 'claude-sonnet-5-5'
export const MAX_GAP_SKILLS = 8
const MAX_SKILL_CHARS = 60

export interface GapPlan {
  skill: string
  /** False for things a course can't close: years of experience, degrees, clearances. */
  closeable: boolean
  /** "2 to 3 weeks, a few hours a week" */
  time: string
  learn: string
  build: string
  /** How it reads on a resume once it's real. */
  addAs: string
  /** Search words for the course links. */
  query: string
}

export interface GapLink {
  label: string
  href: string
  /** True when the link carries an affiliate tag (the UI shows a disclosure). */
  partner: boolean
}

export class GapPlanError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly userMessage: string,
    public readonly kind: string = 'invalid_output'
  ) {
    super(message)
    this.name = 'GapPlanError'
  }
}

/** Cache key: same skill however it's capitalised or spaced. */
export const gapKey = (skill: string) => skill.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, MAX_SKILL_CHARS)

export function cleanSkills(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of raw) {
    if (typeof s !== 'string') continue
    const skill = s.replace(/\s+/g, ' ').trim().slice(0, MAX_SKILL_CHARS)
    const key = gapKey(skill)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(skill)
  }
  return out.slice(0, MAX_GAP_SKILLS)
}

const GAP_SCHEMA = {
  type: 'object',
  properties: {
    plans: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skill: { type: 'string' },
          closeable: { type: 'boolean' },
          time: { type: 'string' },
          learn: { type: 'string' },
          build: { type: 'string' },
          addAs: { type: 'string' },
          query: { type: 'string' },
        },
        required: ['skill', 'closeable', 'time', 'learn', 'build', 'addAs', 'query'],
        additionalProperties: false,
      },
    },
  },
  required: ['plans'],
  additionalProperties: false,
} as const

const SYSTEM =
  'You are a practical career coach. For each skill, say what it would honestly take a working adult to gain it well enough to talk about it in an interview. Short, plain words. Never name a specific course, school, company or website, and never write a link.'

export function buildGapPrompt(skills: string[]): string {
  return [
    'A job asks for these skills and the person does not have them yet:',
    ...skills.map((s) => `- ${s}`),
    '',
    'For each skill return:',
    '- skill: the skill exactly as given',
    '- closeable: false if a course or project cannot close it (years of experience, a degree, a security clearance, a license that takes years). Otherwise true.',
    '- time: a realistic range at a few hours a week, like "1 to 2 weeks" or "2 to 3 months". For closeable false, say what it really takes in a few words.',
    '- learn: one sentence on what to study and what kind of course fits (for example "a beginner online course that covers joins and grouping"). For closeable false, one sentence on what to do instead, like applying anyway if they meet most of the rest.',
    '- build: one small project or exercise that proves it, doable in a weekend or two. For closeable false, an empty string.',
    '- addAs: how it would read on a resume once done, in a few words, like "Courses: SQL for data analysis (online)" or "Projects: a dashboard of city bike data in Tableau". For closeable false, an empty string.',
    '- query: 2 to 5 words to search course sites with, like "sql for beginners".',
    '',
    'No em-dashes. Each field under 160 characters.',
  ].join('\n')
}

const clip = (s: unknown, n = 160) =>
  typeof s === 'string'
    ? s
        .replace(/https?:\/\/\S+/g, '')
        .replace(/—/g, ', ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, n)
    : ''

/** Keep only plans for skills we asked about, trimmed, with no links or em-dashes. */
export function cleanGapPlans(raw: unknown, asked: string[]): GapPlan[] {
  const byKey = new Map(asked.map((s) => [gapKey(s), s]))
  const list = Array.isArray((raw as { plans?: unknown })?.plans) ? (raw as { plans: unknown[] }).plans : []
  const out: GapPlan[] = []
  for (const p of list) {
    const r = p as Record<string, unknown>
    const skill = byKey.get(gapKey(typeof r?.skill === 'string' ? r.skill : ''))
    if (!skill) continue
    byKey.delete(gapKey(skill))
    const closeable = r.closeable !== false
    const plan: GapPlan = {
      skill,
      closeable,
      time: clip(r.time, 60),
      learn: clip(r.learn),
      build: closeable ? clip(r.build) : '',
      addAs: closeable ? clip(r.addAs, 120) : '',
      query: clip(r.query, 60) || skill,
    }
    if (!plan.time || !plan.learn) continue
    out.push(plan)
  }
  return out
}

export async function generateGapPlans(skills: string[], options: AICallOptions = {}): Promise<GapPlan[]> {
  if (skills.length === 0) return []
  try {
    const result = await generateStructured<unknown>({
      task: 'evidence',
      system: SYSTEM,
      messages: [{ role: 'user', content: buildGapPrompt(skills) }],
      schema: GAP_SCHEMA as unknown as Record<string, unknown>,
      schemaName: 'gap_plans',
      maxTokens: 2000,
      temperature: 0.2,
      effort: 'low',
      ...callOverrides('evidence', { model: GAP_MODEL, ...options }),
    })
    return cleanGapPlans(result.data, skills)
  } catch (error) {
    if (error instanceof AIOutputError) throw new GapPlanError(error.message, 502, 'Something went wrong. Please try again.')
    const classified = classifyAIError(error, 'Close the gap')
    throw new GapPlanError(String((error as Error)?.message || 'Unknown AI error'), classified.status, classified.userMessage, classified.kind)
  }
}

// ---------- links ----------

interface Site {
  label: string
  search: (q: string) => string
  /** Env var holding an affiliate link template with {url} (the encoded target). */
  affiliateEnv?: string
}

const SITES: Site[] = [
  { label: 'Coursera', search: (q) => `https://www.coursera.org/search?query=${encodeURIComponent(q)}`, affiliateEnv: 'AFFILIATE_COURSERA' },
  { label: 'Udemy', search: (q) => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(q)}`, affiliateEnv: 'AFFILIATE_UDEMY' },
  { label: 'YouTube', search: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
]

/** A template must be https and carry {url}; anything else is ignored. */
export function wrapAffiliate(target: string, template: string | undefined): string | null {
  const t = template?.trim()
  if (!t || !t.startsWith('https://') || !t.includes('{url}')) return null
  return t.replace('{url}', encodeURIComponent(target))
}

/** Search links for a plan. Server only: reads the affiliate templates from env. */
export function gapLinks(plan: Pick<GapPlan, 'query' | 'closeable'>, env: Record<string, string | undefined> = process.env): GapLink[] {
  if (!plan.closeable) return []
  return SITES.map((site) => {
    const href = site.search(plan.query)
    const wrapped = site.affiliateEnv ? wrapAffiliate(href, env[site.affiliateEnv]) : null
    return { label: site.label, href: wrapped ?? href, partner: !!wrapped }
  })
}

// ---------- cache ----------

interface GapDb {
  skillGap: {
    findMany(args: { where: { key: { in: string[] } }; select: { key: true; plan: true } }): Promise<{ key: string; plan: unknown }[]>
    createMany(args: { data: { key: string; skill: string; plan: object; model: string }[]; skipDuplicates: true }): Promise<unknown>
  }
}

const isPlan = (p: unknown): p is GapPlan => !!p && typeof (p as GapPlan).learn === 'string' && typeof (p as GapPlan).time === 'string'

/**
 * Plans for these skills: cached ones from the table, the rest from one model call (then
 * saved). Before the table exists (SQL not pasted) it still works, just without the cache.
 */
export async function gapPlans(
  db: GapDb,
  skills: string[],
  generate: (missing: string[]) => Promise<GapPlan[]> = (m) => generateGapPlans(m)
): Promise<{ plans: GapPlan[]; generated: number }> {
  const keys = skills.map(gapKey)
  let cached: { key: string; plan: unknown }[] = []
  try {
    cached = await db.skillGap.findMany({ where: { key: { in: keys } }, select: { key: true, plan: true } })
  } catch (e) {
    console.error('[gap-plan] cache read failed:', (e as Error)?.message)
  }
  const have = new Map<string, GapPlan>()
  for (const row of cached) if (isPlan(row.plan)) have.set(row.key, row.plan)

  const missing = skills.filter((s) => !have.has(gapKey(s)))
  const fresh = missing.length ? await generate(missing) : []
  if (fresh.length) {
    try {
      await db.skillGap.createMany({
        data: fresh.map((p) => ({ key: gapKey(p.skill), skill: p.skill, plan: p as unknown as object, model: GAP_MODEL })),
        skipDuplicates: true,
      })
    } catch (e) {
      console.error('[gap-plan] cache write failed:', (e as Error)?.message)
    }
    for (const p of fresh) have.set(gapKey(p.skill), p)
  }
  const plans = skills.flatMap((s) => {
    const p = have.get(gapKey(s))
    return p ? [{ ...p, skill: s }] : []
  })
  return { plans, generated: fresh.length }
}
