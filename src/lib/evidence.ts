// Evidence interview: the honest way to stronger bullets. Instead of inventing numbers,
// ask the user for them.
//
// 1. weakBulletCandidates: score every master bullet (no number, vague verb, no outcome,
//    short) and keep the weakest dozen. Pure.
// 2. generateQuestions: the model picks the 5-8 weakest of those and writes 1-3 short,
//    targeted questions for each (json_schema). Ids it didn't get are dropped.
// 3. rewriteWithEvidence: rewrite only the answered bullets, from the original text and
//    the answers only. The fact guard (text-facts.ts) runs with the answers added to the
//    allowed text, so the user's numbers pass and nothing else does. A rewrite that fails
//    the guard is dropped, not "fixed".
// 4. applyRewrites: accepted rewrites replace the bullet in the MASTER. This is the only
//    place master text comes from AI, and only after an explicit Accept.
import OpenAI from 'openai'
import { classifyAIError } from '@/lib/ai-errors'
import { extractNumbers, normalizeSpace } from '@/lib/resume-text'
import { describeFacts, hasUnsupported, unsupportedFacts } from '@/lib/text-facts'
import { isNonAnswer, type EvidenceAnswer, type EvidenceItem, type EvidenceRewrite } from '@/lib/evidence-shared'
import type { ParsedResume } from '@/types/parsed-resume'

export * from '@/lib/evidence-shared'

export const DEFAULT_EVIDENCE_MODEL = 'gpt-4o'
export function evidenceModel(): string {
  return process.env.OPENAI_EVIDENCE_MODEL || process.env.OPENAI_TAILOR_MODEL || DEFAULT_EVIDENCE_MODEL
}

export const MIN_ITEMS = 5
export const MAX_ITEMS = 8
const MAX_CANDIDATES = 12
const MAX_QUESTIONS = 3

// ---------- 1. weak bullets (pure) ----------

const VAGUE_START =
  /^(helped|assisted|aided|worked (on|with|in)|responsible for|participated|involved in|supported|handled|did|was|were|contributed to|tasked with|duties included|in charge of|part of|utilized|used)\b/i
const OUTCOME = /\b(increas|reduc|improv|cut|sav|grew|grow|boost|decreas|lower|rais|doubl|tripl|result|led to|so that|enabl|shorten|speed|faster|won|award|revenue|profit|retention|conversion)/i

export interface BulletCandidate {
  id: string
  section: 'roles' | 'projects'
  entryId: string
  entryLabel: string
  index: number
  bullet: string
  score: number
  reasons: string[]
}

export function bulletWeakness(text: string): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0
  if (extractNumbers(text).length === 0) {
    score += 3
    reasons.push('No scale or numbers')
  }
  if (VAGUE_START.test(text.trim())) {
    score += 2
    reasons.push('Vague verb')
  }
  if (!OUTCOME.test(text)) {
    score += 2
    reasons.push('No outcome')
  }
  if (text.split(/\s+/).length < 8) {
    score += 1
    reasons.push('Short')
  }
  return { score, reasons }
}

/** Every master bullet, scored; the weakest first. Bullets with a number AND an outcome are left alone. */
export function weakBulletCandidates(resume: ParsedResume, limit = MAX_CANDIDATES): BulletCandidate[] {
  const all: BulletCandidate[] = []
  for (const e of resume.experience) {
    e.bullets.forEach((bullet, index) => {
      if (!bullet.trim()) return
      all.push({
        id: `${e.id}:${index}`,
        section: 'roles',
        entryId: e.id,
        entryLabel: [e.title, e.company].filter(Boolean).join(' at '),
        index,
        bullet: bullet.trim(),
        ...bulletWeakness(bullet),
      })
    })
  }
  for (const p of resume.projects) {
    p.bullets.forEach((bullet, index) => {
      if (!bullet.trim()) return
      all.push({ id: `${p.id}:${index}`, section: 'projects', entryId: p.id, entryLabel: p.name, index, bullet: bullet.trim(), ...bulletWeakness(bullet) })
    })
  }
  return all
    .filter((c) => c.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** One specific bullet (the Changes tab's "Make it stronger"), matched by text. */
export function candidateForBullet(resume: ParsedResume, entryId: string, bullet: string): BulletCandidate | null {
  const norm = (s: string) => normalizeSpace(s).toLowerCase()
  const entries = [
    ...resume.experience.map((e) => ({ section: 'roles' as const, id: e.id, label: [e.title, e.company].filter(Boolean).join(' at '), bullets: e.bullets })),
    ...resume.projects.map((p) => ({ section: 'projects' as const, id: p.id, label: p.name, bullets: p.bullets })),
  ]
  const entry = entries.find((e) => e.id === entryId)
  const index = entry ? entry.bullets.findIndex((b) => norm(b) === norm(bullet)) : -1
  if (!entry || index === -1) return null
  const text = entry.bullets[index].trim()
  return { id: `${entry.id}:${index}`, section: entry.section, entryId: entry.id, entryLabel: entry.label, index, bullet: text, ...bulletWeakness(text) }
}

// ---------- model plumbing ----------

export class EvidenceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly userMessage: string
  ) {
    super(message)
    this.name = 'EvidenceError'
  }
}

let defaultClient: OpenAI | null = null
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[OPENAI_NOT_CONFIGURED] OPENAI_API_KEY is not set')
    throw new EvidenceError('OPENAI_API_KEY is not configured', 503, "The evidence interview is temporarily unavailable, we're on it.")
  }
  defaultClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return defaultClient
}

export interface EvidenceOptions {
  client?: OpenAI
  model?: string
}

async function structured<T>(options: EvidenceOptions, name: string, schema: object, system: string, prompt: string, temperature: number): Promise<T> {
  const client = options.client ?? getClient()
  const model = options.model ?? evidenceModel()
  let completion
  try {
    completion = await client.chat.completions.create({
      model,
      temperature,
      max_tokens: 2000,
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema: schema as Record<string, unknown> } },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    })
  } catch (error) {
    const classified = classifyAIError(error, 'The evidence interview')
    throw new EvidenceError(String((error as Error)?.message || 'Unknown OpenAI error'), classified.status, classified.userMessage)
  }
  const content = completion.choices[0]?.message?.content
  if (!content || completion.choices[0]?.finish_reason === 'length') {
    throw new EvidenceError('Empty or truncated model response', 502, 'Something went wrong. Please try again.')
  }
  try {
    return JSON.parse(content) as T
  } catch {
    throw new EvidenceError('Model returned invalid JSON', 502, 'Something went wrong. Please try again.')
  }
}

// ---------- 2. questions ----------

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The bullet id, copied exactly.' },
          weakness: { type: 'string', description: 'What the bullet is missing, 2-5 words.' },
          questions: { type: 'array', items: { type: 'string' }, description: '1-3 short questions.' },
        },
        required: ['id', 'weakness', 'questions'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

const QUESTIONS_SYSTEM = `You interview job seekers to find the real numbers and outcomes behind their resume bullets. You ask; you never assume or suggest answers.`

export function buildQuestionsPrompt(candidates: BulletCandidate[], focused: boolean): string {
  const count = focused ? 'this bullet' : `the ${Math.min(MIN_ITEMS, candidates.length)}-${Math.min(MAX_ITEMS, candidates.length)} weakest of these bullets`
  return `Pick ${count} and write questions that would let the candidate add real scale and outcomes.

BULLETS:
${candidates.map((c) => `- id: ${c.id}\n  role: ${c.entryLabel}\n  bullet: ${c.bullet}\n  flagged: ${c.reasons.join(', ')}`).join('\n')}

RULES:
1. 1-3 questions per bullet, each under 15 words, answerable in a few words.
2. Ask for things only the candidate knows: scale ("Roughly how many users/orders/people?"), change ("What changed after, and by how much?"), counterfactual ("What would have happened without it?"), time or money saved.
3. Never put a number or a guess in the question. Don't ask about things the bullet already states.
4. Copy each id exactly. Weakest bullets first.`
}

function cleanQuestion(q: string): string {
  const text = normalizeSpace(q).replace(/^[-*\d.)\s]+/, '')
  return text && !/[?]$/.test(text) ? `${text}?` : text
}

export async function generateQuestions(candidates: BulletCandidate[], options: EvidenceOptions & { focused?: boolean } = {}): Promise<EvidenceItem[]> {
  if (candidates.length === 0) return []
  const output = await structured<{ items: { id: string; weakness: string; questions: string[] }[] }>(
    options,
    'evidence_questions',
    QUESTIONS_SCHEMA,
    QUESTIONS_SYSTEM,
    buildQuestionsPrompt(candidates, !!options.focused),
    0.3
  )
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const items: EvidenceItem[] = []
  for (const raw of output.items ?? []) {
    const c = byId.get(raw.id)
    if (!c || seen.has(c.id)) continue // ids the model made up are dropped
    const questions = (raw.questions ?? []).map(cleanQuestion).filter(Boolean).slice(0, MAX_QUESTIONS)
    if (questions.length === 0) continue
    seen.add(c.id)
    items.push({
      id: c.id,
      section: c.section,
      entryId: c.entryId,
      entryLabel: c.entryLabel,
      index: c.index,
      bullet: c.bullet,
      weakness: normalizeSpace(raw.weakness || '') || c.reasons[0] || '',
      questions: questions.map((text, i) => ({ id: `${c.id}:q${i}`, text })),
    })
    if (items.length >= MAX_ITEMS) break
  }
  return items
}

// ---------- 3. rewrite ----------

const REWRITE_SCHEMA = {
  type: 'object',
  properties: {
    rewrites: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, text: { type: 'string' } },
        required: ['id', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['rewrites'],
  additionalProperties: false,
} as const

const REWRITE_SYSTEM = `You rewrite resume bullets using only the original bullet and the candidate's own answers. You never add a fact, number, tool or claim the candidate didn't give you.`

/** Items with at least one real answer, with those answers. */
export function answeredItems(items: EvidenceItem[], answers: EvidenceAnswer[]): { item: EvidenceItem; answers: EvidenceAnswer[] }[] {
  return items
    .map((item) => ({ item, answers: answers.filter((a) => a.itemId === item.id && !isNonAnswer(a.answer)) }))
    .filter((x) => x.answers.length > 0)
}

export function buildRewritePrompt(answered: { item: EvidenceItem; answers: EvidenceAnswer[] }[]): string {
  return `Rewrite each bullet using ONLY its original text and the candidate's answers.

${answered
  .map(
    ({ item, answers }) =>
      `- id: ${item.id}\n  original: ${item.bullet}\n  answers:\n${answers.map((a) => `    Q: ${a.question}\n    A: ${a.answer.trim()}`).join('\n')}`
  )
  .join('\n')}

RULES:
1. Use the candidate's numbers exactly as given (you may write "about"/"roughly" if they did). Never add a number, tool, employer, or outcome they didn't state.
2. Start with a strong action verb. One line, two at most. Past tense unless the original is present tense.
3. Keep every fact from the original bullet.
4. Return every id exactly once.`
}

/**
 * Allowed text for one bullet: the original plus that item's answers, nothing else. The
 * question an answer replies to counts too, minus any digits: "4000" answering "How many
 * SKUs?" means "4,000 SKUs", but a number can only ever come from the user.
 */
export function rewriteAllowedText(item: EvidenceItem, answers: EvidenceAnswer[]): string {
  return [item.bullet, ...answers.flatMap((a) => [a.answer, a.question.replace(/\d/g, ' ')])].join('\n')
}

export function guardRewrite(item: EvidenceItem, answers: EvidenceAnswer[], text: string): { ok: true; text: string } | { ok: false; reason: string } {
  const clean = normalizeSpace(text).replace(/^[-•*]\s*/, '')
  if (!clean) return { ok: false, reason: 'The rewrite came back empty.' }
  const facts = unsupportedFacts(clean, rewriteAllowedText(item, answers))
  if (hasUnsupported(facts)) {
    return { ok: false, reason: `The rewrite added things you didn't say (${describeFacts(facts)}), so we kept your original.` }
  }
  return { ok: true, text: clean }
}

export async function rewriteWithEvidence(items: EvidenceItem[], answers: EvidenceAnswer[], options: EvidenceOptions = {}): Promise<EvidenceRewrite[]> {
  const answered = answeredItems(items, answers)
  if (answered.length === 0) return []
  const output = await structured<{ rewrites: { id: string; text: string }[] }>(
    options,
    'evidence_rewrites',
    REWRITE_SCHEMA,
    REWRITE_SYSTEM,
    buildRewritePrompt(answered),
    0.2
  )
  const byId = new Map((output.rewrites ?? []).map((r) => [r.id, r.text]))
  return answered.map(({ item, answers: itemAnswers }) => {
    const base = { itemId: item.id, entryId: item.entryId, section: item.section, index: item.index, entryLabel: item.entryLabel, before: item.bullet }
    const attempted = byId.get(item.id)
    if (attempted === undefined) return { ...base, after: item.bullet, warning: 'No rewrite came back for this bullet.' }
    const guarded = guardRewrite(item, itemAnswers, attempted)
    return guarded.ok ? { ...base, after: guarded.text } : { ...base, after: item.bullet, warning: guarded.reason }
  })
}

// ---------- 4. apply to the master (pure) ----------

/**
 * Replace accepted bullets in the master. A bullet is only replaced if it still reads
 * exactly like `before` (so a stale review can't clobber an edit made meanwhile).
 * Returns the new resume and how many bullets changed.
 */
export function applyRewrites(resume: ParsedResume, accepted: Pick<EvidenceRewrite, 'section' | 'entryId' | 'index' | 'before' | 'after'>[]): { resume: ParsedResume; applied: number } {
  const next: ParsedResume = JSON.parse(JSON.stringify(resume))
  const norm = (s: string) => normalizeSpace(s).toLowerCase()
  let applied = 0
  for (const r of accepted) {
    if (norm(r.before) === norm(r.after)) continue
    const entry = r.section === 'roles' ? next.experience.find((e) => e.id === r.entryId) : next.projects.find((p) => p.id === r.entryId)
    if (!entry) continue
    const index = norm(entry.bullets[r.index] ?? '') === norm(r.before) ? r.index : entry.bullets.findIndex((b) => norm(b) === norm(r.before))
    if (index === -1) continue
    entry.bullets[index] = r.after
    applied++
  }
  return { resume: next, applied }
}
