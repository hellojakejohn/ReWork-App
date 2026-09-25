// Cover letter per job. Same pattern as the tailor engine: model from env, structured
// output, then a fact guard we trust more than the prompt.
//
// Flow: master (TailorInput) + tailored version + job -> OpenAI json_schema (greeting,
// three paragraphs, sign-off) -> checks (banned phrases, unsupported numbers/names,
// length) -> one regenerate with the problems spelled out if anything failed -> whatever
// still fails is removed sentence by sentence and reported as a warning.
import OpenAI from 'openai'
import { classifyAIError } from '@/lib/ai-errors'
import { normalizeSpace, tailorInputText } from '@/lib/resume-text'
import { describeFacts, dropUnsupportedSentences, hasUnsupported, splitSentences, unsupportedFacts } from '@/lib/text-facts'
import type { TailorInput } from '@/types/tailor'
import type { CoverLetterTone, CoverLetterWarning, StoredCoverLetter } from '@/lib/cover-letter-shared'

export * from '@/lib/cover-letter-shared'

export const DEFAULT_COVER_LETTER_MODEL = 'gpt-4o'

export function coverLetterModel(): string {
  return process.env.OPENAI_COVER_LETTER_MODEL || process.env.OPENAI_TAILOR_MODEL || DEFAULT_COVER_LETTER_MODEL
}


export const MIN_WORDS = 250
export const MAX_WORDS = 350

// Openers and filler that make a letter read like every other letter. Matched case-
// insensitively as phrases. If one slips through, the letter is regenerated once, then the
// sentence is dropped.
export const BANNED_PHRASES = [
  'i am writing to express my interest',
  'i am writing to apply',
  'i am writing to',
  'i would like to express my interest',
  'please accept this letter',
  'to whom it may concern',
  'i am excited to apply',
  "i'm excited to apply",
  'i was thrilled to',
  'perfect fit',
  'ideal candidate',
  'great fit for',
  'proven track record',
  'results-driven',
  'detail-oriented',
  'team player',
  'self-starter',
  'go-getter',
  'hit the ground running',
  'think outside the box',
  'fast-paced environment',
  'wear many hats',
  'go above and beyond',
  'above and beyond',
  'synergy',
  'leverage my skills',
  'passionate about',
  'dynamic team',
  'cutting-edge',
  'in today’s',
  "in today's",
  'rockstar',
  'ninja',
  'thank you for your time and consideration',
  'i look forward to hearing from you',
]

export interface CoverLetterDraft {
  greeting: string
  whyThisRole: string
  proof: string
  close: string
  signOff: string
}


export interface CoverLetterJob {
  title: string
  company: string
  description: string
}

export interface CoverLetterInput {
  master: TailorInput
  /** The tailored resume as plain text: what to emphasize. Never a source of new facts. */
  tailoredText: string
  candidateName: string
  job: CoverLetterJob
  tone: CoverLetterTone
  /** User-supplied facts (evidence interview answers). Allowed like resume text. */
  extraFacts?: string[]
}

// ---------- prompt ----------

const SCHEMA = {
  type: 'object',
  properties: {
    greeting: { type: 'string', description: 'e.g. "Dear Hiring Team," or "Dear Acme hiring team,". No invented names.' },
    whyThisRole: { type: 'string', description: 'Paragraph 1: why this role and company, 2-3 sentences.' },
    proof: { type: 'string', description: 'Paragraph 2: the 2-3 most relevant proof points from the resume.' },
    close: { type: 'string', description: 'Paragraph 3: short close with a clear next step.' },
    signOff: { type: 'string', description: 'e.g. "Sincerely," or "Best,". No name.' },
  },
  required: ['greeting', 'whyThisRole', 'proof', 'close', 'signOff'],
  additionalProperties: false,
} as const

const TONE_GUIDE: Record<CoverLetterTone, string> = {
  professional: 'Professional: polished and measured, plain business English, no slang.',
  warm: 'Warm: friendly and personable, first person, genuine enthusiasm shown through specifics rather than adjectives.',
  direct: 'Direct: short sentences, lead with the strongest point, no warm-up, confident without boasting.',
}

const SYSTEM_PROMPT = `You write short, specific cover letters from a candidate's real resume. You never invent facts, and you write like a person, not a template.`

export function buildCoverLetterPrompt(input: CoverLetterInput, feedback: string[] = []): string {
  const facts = input.extraFacts?.length ? `\nCANDIDATE-CONFIRMED FACTS (from the candidate, usable like resume facts):\n${input.extraFacts.map((f) => `- ${f}`).join('\n')}\n` : ''
  return `Write a cover letter for this job.

RESUME (JSON, the only source of facts about the candidate):
${JSON.stringify(input.master, null, 2)}
${facts}
TAILORED RESUME FOR THIS JOB (what to emphasize; same facts):
${input.tailoredText}

TARGET JOB:
Title: ${input.job.title}
Company: ${input.job.company}
Description:
${input.job.description}

TONE: ${TONE_GUIDE[input.tone]}

RULES (all mandatory):
1. Three paragraphs: (1) why this role and this company, (2) the 2-3 most relevant proof points from the resume, (3) a short close.
2. ${MIN_WORDS}-${MAX_WORDS} words total across the three paragraphs.
3. Never fabricate. Only mention employers, schools, tools, technologies, credentials and numbers that appear in the resume or the confirmed facts. Do not add metrics, team sizes, years of experience or percentages that aren't there.
4. Refer to the company by name. Describe what the role needs in general words; do not claim experience with tools from the job description that the resume doesn't list.
5. Greeting: "Dear Hiring Team," or "Dear ${input.job.company} team," unless the job description names the hiring manager. Never invent a person's name.
6. Sign-off: one or two words with a comma (e.g. "Sincerely,"). No name; we add it.
7. Don't open with "I am writing to..." or any stock opener. Avoid these phrases entirely: ${BANNED_PHRASES.map((p) => `"${p}"`).join(', ')}.
8. No bullet points, no headings, no placeholders like [Company].${
    feedback.length
      ? `

YOUR PREVIOUS DRAFT HAD THESE PROBLEMS. FIX ALL OF THEM:
${feedback.map((f) => `- ${f}`).join('\n')}`
      : ''
  }`
}

// ---------- checks (pure) ----------

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length
}

export function bannedPhrasesIn(text: string): string[] {
  const lower = normalizeSpace(text).toLowerCase().replace(/’/g, "'")
  return BANNED_PHRASES.filter((p) => lower.includes(p.replace(/’/g, "'")))
    // "i am writing to apply" also matches "i am writing to"; report the longest only.
    .filter((p, _, all) => !all.some((other) => other !== p && other.includes(p) && lower.includes(other)))
}

/** Everything the letter may state as fact. */
export function allowedSourceText(input: Pick<CoverLetterInput, 'master' | 'candidateName' | 'job' | 'extraFacts'>): string {
  return [tailorInputText(input.master), input.candidateName, input.job.title, input.job.company, ...(input.extraFacts ?? [])].join('\n')
}

const PARAGRAPHS = ['whyThisRole', 'proof', 'close'] as const

export interface DraftProblems {
  banned: string[]
  facts: { paragraph: (typeof PARAGRAPHS)[number]; detail: string }[]
  words: number
}

export function checkDraft(draft: CoverLetterDraft, allowedText: string): DraftProblems {
  const body = PARAGRAPHS.map((p) => draft[p]).join('\n\n')
  const facts = PARAGRAPHS.flatMap((paragraph) => {
    const f = unsupportedFacts(draft[paragraph] || '', allowedText)
    return hasUnsupported(f) ? [{ paragraph, detail: describeFacts(f) }] : []
  })
  return { banned: bannedPhrasesIn(`${draft.greeting}\n${body}\n${draft.signOff}`), facts, words: countWords(body) }
}

function hasProblems(p: DraftProblems): boolean {
  return p.banned.length > 0 || p.facts.length > 0 || p.words < MIN_WORDS - 30 || p.words > MAX_WORDS + 40
}

export function feedbackFor(p: DraftProblems): string[] {
  const out: string[] = []
  if (p.banned.length) out.push(`Remove these banned phrases: ${p.banned.map((b) => `"${b}"`).join(', ')}.`)
  for (const f of p.facts) out.push(`Paragraph "${f.paragraph}" mentions things not in the resume (${f.detail}). Remove them or use only resume facts.`)
  if (p.words < MIN_WORDS - 30) out.push(`Too short (${p.words} words). Aim for ${MIN_WORDS}-${MAX_WORDS}.`)
  if (p.words > MAX_WORDS + 40) out.push(`Too long (${p.words} words). Aim for ${MIN_WORDS}-${MAX_WORDS}.`)
  return out
}

const SAFE_GREETING = /^(dear|hello|hi)\b/i

/**
 * Last line of defense after the retry: drop sentences with banned phrases or unsupported
 * facts, reset an invented greeting, strip names from the sign-off.
 */
export function guardDraft(
  draft: CoverLetterDraft,
  input: Pick<CoverLetterInput, 'master' | 'candidateName' | 'job' | 'extraFacts'>
): { draft: CoverLetterDraft; warnings: CoverLetterWarning[] } {
  const allowedText = allowedSourceText(input)
  const warnings: CoverLetterWarning[] = []
  const out: CoverLetterDraft = { ...draft }

  for (const paragraph of PARAGRAPHS) {
    const kept: string[] = []
    for (const sentence of splitSentences(normalizeSpace(draft[paragraph] || ''))) {
      const banned = bannedPhrasesIn(sentence)
      if (banned.length) {
        warnings.push({ type: 'banned_phrase', message: `Removed a stock phrase ("${banned[0]}").`, attempted: sentence })
        continue
      }
      const { removed } = dropUnsupportedSentences(sentence, allowedText)
      if (removed.length) {
        warnings.push({
          type: 'unsupported_fact',
          message: `Removed a sentence that mentioned things not in your resume (${describeFacts(removed[0].facts)}).`,
          attempted: sentence,
        })
        continue
      }
      kept.push(sentence)
    }
    out[paragraph] = kept.join(' ')
  }

  // Greetings may name the company or a person the job post names; anything else resets.
  const greeting = normalizeSpace(draft.greeting || '')
  const greetingFacts = unsupportedFacts(greeting, `${allowedText}\n${input.job.description}`)
  if (!greeting || !SAFE_GREETING.test(greeting) || hasUnsupported(greetingFacts) || bannedPhrasesIn(greeting).length) {
    if (greeting) warnings.push({ type: 'greeting_reset', message: `Replaced the greeting "${greeting}" with a neutral one.`, attempted: greeting })
    out.greeting = 'Dear Hiring Team,'
  } else {
    out.greeting = /[,:]$/.test(greeting) ? greeting : `${greeting},`
  }

  const signOff = normalizeSpace(draft.signOff || '').split(/\s+/).slice(0, 3).join(' ').replace(/[,.]?$/, ',')
  out.signOff = /^[A-Za-z][A-Za-z ]*,$/.test(signOff) && !nameIn(signOff, input.candidateName) ? signOff : 'Sincerely,'

  const words = countWords(PARAGRAPHS.map((p) => out[p]).join(' '))
  if (words < MIN_WORDS - 80) {
    warnings.push({ type: 'length', message: `The letter is short (${words} words) after the fact check. Add a line of your own or regenerate.` })
  }
  return { draft: out, warnings }
}

function nameIn(text: string, name: string): boolean {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 1)
    .some((part) => text.toLowerCase().includes(part.toLowerCase()))
}

/** The letter as plain text: greeting, three paragraphs, sign-off + name. */
export function draftToText(draft: CoverLetterDraft, candidateName: string): string {
  return [draft.greeting, ...PARAGRAPHS.map((p) => draft[p]).filter(Boolean), [draft.signOff, candidateName].filter(Boolean).join('\n')]
    .map((b) => b.trim())
    .filter(Boolean)
    .join('\n\n')
}

// ---------- model call ----------

export class CoverLetterError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly userMessage: string
  ) {
    super(message)
    this.name = 'CoverLetterError'
  }
}

let defaultClient: OpenAI | null = null
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[OPENAI_NOT_CONFIGURED] OPENAI_API_KEY is not set')
    throw new CoverLetterError('OPENAI_API_KEY is not configured', 503, "Cover letters are temporarily unavailable, we're on it.")
  }
  defaultClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return defaultClient
}

export interface CoverLetterOptions {
  client?: OpenAI
  model?: string
}

async function callModel(client: OpenAI, model: string, prompt: string): Promise<{ draft: CoverLetterDraft; model: string }> {
  let completion
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: 0.5,
      max_tokens: 1200,
      response_format: { type: 'json_schema', json_schema: { name: 'cover_letter', strict: true, schema: SCHEMA as unknown as Record<string, unknown> } },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    })
  } catch (error) {
    const classified = classifyAIError(error, 'Cover letters')
    throw new CoverLetterError(String((error as Error)?.message || 'Unknown OpenAI error'), classified.status, classified.userMessage)
  }
  const choice = completion.choices[0]
  if (choice?.message?.refusal) {
    throw new CoverLetterError(`Model refused: ${choice.message.refusal}`, 422, 'The AI declined to write this letter. Check the job description and try again.')
  }
  const content = choice?.message?.content
  if (!content || choice?.finish_reason === 'length') {
    throw new CoverLetterError('Empty or truncated model response', 502, "We couldn't write the letter. Please try again.")
  }
  try {
    return { draft: JSON.parse(content) as CoverLetterDraft, model: completion.model || model }
  } catch {
    throw new CoverLetterError('Model returned invalid JSON', 502, "We couldn't write the letter. Please try again.")
  }
}

export async function generateCoverLetter(input: CoverLetterInput, options: CoverLetterOptions = {}): Promise<StoredCoverLetter> {
  const client = options.client ?? getClient()
  const model = options.model ?? coverLetterModel()
  const allowedText = allowedSourceText(input)

  let result = await callModel(client, model, buildCoverLetterPrompt(input))
  const warnings: CoverLetterWarning[] = []
  const problems = checkDraft(result.draft, allowedText)
  if (hasProblems(problems)) {
    // Regenerate once with the problems spelled out. If the retry fails outright, keep
    // the first draft and let the guard clean it.
    const feedback = feedbackFor(problems)
    try {
      result = await callModel(client, model, buildCoverLetterPrompt(input, feedback))
      warnings.push({ type: 'regenerated', message: `Rewrote the letter once: ${feedback.join(' ')}` })
    } catch (error) {
      console.error('[cover-letter] retry failed, guarding the first draft:', (error as Error)?.message)
    }
  }

  const guarded = guardDraft(result.draft, input)
  return {
    version: 1,
    tone: input.tone,
    text: draftToText(guarded.draft, input.candidateName),
    warnings: [...warnings, ...guarded.warnings],
    model: result.model,
    generatedAt: new Date().toISOString(),
    edited: false,
  }
}

