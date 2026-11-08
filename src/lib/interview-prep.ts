// Interview prep for one tailored job: the questions this interviewer is likely to ask,
// what each one checks, and which of the candidate's own bullets answer it.
//
// Facts stay real by construction: the model never writes the proof. It gets the tailored
// resume's bullets as a numbered list and answers with numbers; we map those back to the
// exact bullet text and drop any number that isn't on the list. The prose it does write
// ("why", "angle", questions to ask) goes through the prose fact guard. Runs on the cover
// letter model (task 'coverLetter').
import { AIOutputError, classifyAIError } from '@/lib/ai-errors'
import { callOverrides, generateStructured, type AICallOptions } from '@/lib/ai'
import { normalizeSpace } from '@/lib/resume-text'
import { dropUnsupportedSentences } from '@/lib/text-facts'
import { toLayout } from '@/lib/resume-templates'
import type { CoverLetterJob } from '@/lib/cover-letter'
import type { ParsedResume } from '@/types/parsed-resume'
import { PREP_QUESTIONS, type PrepQuestion, type StoredInterviewPrep } from '@/lib/interview-prep-shared'

export * from '@/lib/interview-prep-shared'

const MAX_BULLETS_PER_QUESTION = 3

export interface PrepInput {
  tailored: ParsedResume
  /** Everything the prose may state as fact (resume text, confirmed facts, name, job title, company). */
  allowedText: string
  job: CoverLetterJob
}

interface PrepDraft {
  questions: { question: string; why: string; bulletNumbers: number[]; angle: string }[]
  askThem: string[]
}

const SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      description: `Exactly ${PREP_QUESTIONS} likely interview questions for this job, most likely first.`,
      items: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question as the interviewer would ask it.' },
          why: { type: 'string', description: 'One sentence: what the interviewer is really checking, tied to the job.' },
          bulletNumbers: { type: 'array', items: { type: 'integer' }, description: `Up to ${MAX_BULLETS_PER_QUESTION} numbers from the BULLETS list that best answer it. Empty if none do.` },
          angle: { type: 'string', description: '1-2 sentences on how to answer using those bullets. If none fit, how to answer honestly.' },
        },
        required: ['question', 'why', 'bulletNumbers', 'angle'],
        additionalProperties: false,
      },
    },
    askThem: { type: 'array', items: { type: 'string' }, description: '3 thoughtful questions the candidate could ask the interviewer about this role.' },
  },
  required: ['questions', 'askThem'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are an experienced hiring manager helping a candidate prepare for an interview. You are concrete and honest, and you never invent experience the candidate doesn't have.`

/** The tailored resume's bullets, numbered from 1, with where each comes from. */
export function numberedBullets(resume: ParsedResume): { n: number; text: string; source: string }[] {
  const l = toLayout(resume)
  const out: { n: number; text: string; source: string }[] = []
  for (const e of l.experience) for (const b of e.bullets) out.push({ n: out.length + 1, text: b, source: [e.title, e.company].filter(Boolean).join(' at ') })
  for (const p of l.projects) for (const b of p.bullets) out.push({ n: out.length + 1, text: b, source: p.name })
  return out
}

export function buildPrepPrompt(input: PrepInput): string {
  const bullets = numberedBullets(input.tailored)
  return `Prepare this candidate for an interview for the job below.

TARGET JOB:
Title: ${input.job.title}
Company: ${input.job.company}
Description:
${input.job.description}

CANDIDATE SUMMARY:
${input.tailored.summary || '(none)'}

BULLETS (the candidate's real experience, numbered):
${bullets.map((b) => `${b.n}. [${b.source}] ${b.text}`).join('\n') || '(none)'}

RULES (all mandatory):
1. Exactly ${PREP_QUESTIONS} questions this interviewer is likely to ask for THIS job: mix role-specific skills from the description, behavioral ("Tell me about a time..."), and one about a gap or a requirement the candidate's bullets don't clearly cover.
2. For each, pick up to ${MAX_BULLETS_PER_QUESTION} bullet numbers that genuinely answer it. Never pick a bullet just to fill the list. Use an empty list when nothing fits.
3. "angle" uses only what the chosen bullets say. Don't add numbers, tools or employers that aren't in them. When nothing fits, suggest an honest way to answer (adjacent experience, how they'd learn it).
4. "askThem": 3 specific questions about this role or team, not generic ones about culture.
5. Plain words, no em-dashes.`
}

/** Bullet numbers -> exact bullet text. Unknown numbers and repeats are dropped. */
export function bulletsFor(numbers: unknown, bullets: { n: number; text: string }[]): string[] {
  if (!Array.isArray(numbers)) return []
  const byN = new Map(bullets.map((b) => [b.n, b.text]))
  return [...new Set(numbers.filter((n): n is number => Number.isInteger(n)))]
    .map((n) => byN.get(n))
    .filter((t): t is string => !!t)
    .slice(0, MAX_BULLETS_PER_QUESTION)
}

const dash = (s: string) => normalizeSpace((s || '').replace(/\s*[—–]\s*/g, ', '))

/** Keep the sentences the source supports; names from the job post are fine, numbers aren't. */
function guardProse(text: string, allowedText: string, jobDescription: string): string {
  return dropUnsupportedSentences(dash(text), allowedText, jobDescription).text
}

export function guardPrep(draft: PrepDraft, input: PrepInput): Omit<StoredInterviewPrep, 'model' | 'generatedAt'> {
  const bullets = numberedBullets(input.tailored)
  const questions: PrepQuestion[] = (draft.questions || [])
    .map((q) => {
      const chosen = bulletsFor(q.bulletNumbers, bullets)
      return {
        question: guardProse(q.question, input.allowedText, input.job.description),
        why: guardProse(q.why, input.allowedText, input.job.description),
        bullets: chosen,
        // The angle may also lean on the bullets it was given (they are resume text already).
        angle: guardProse(q.angle, `${input.allowedText}\n${chosen.join('\n')}`, input.job.description),
      }
    })
    .filter((q) => q.question)
    .slice(0, PREP_QUESTIONS)
  const askThem = (draft.askThem || []).map((q) => guardProse(q, input.allowedText, input.job.description)).filter(Boolean).slice(0, 3)
  return { version: 1, questions, askThem }
}

export class PrepError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly userMessage: string,
    public readonly kind: string = 'invalid_output'
  ) {
    super(message)
    this.name = 'PrepError'
  }
}

export async function generateInterviewPrep(input: PrepInput, options: AICallOptions = {}): Promise<StoredInterviewPrep> {
  let result: { data: PrepDraft; model: string }
  try {
    result = await generateStructured<PrepDraft>({
      task: 'coverLetter',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrepPrompt(input) }],
      schema: SCHEMA as unknown as Record<string, unknown>,
      schemaName: 'interview_prep',
      maxTokens: 2500,
      temperature: 0.4,
      effort: 'medium',
      ...callOverrides('coverLetter', options),
    })
  } catch (error) {
    if (error instanceof AIOutputError) throw new PrepError(error.message, 502, "We couldn't build your interview prep. Please try again.")
    const classified = classifyAIError(error, 'Interview prep')
    throw new PrepError(String((error as Error)?.message || 'Unknown AI error'), classified.status, classified.userMessage, classified.kind)
  }
  const guarded = guardPrep(result.data, input)
  if (guarded.questions.length < 3) throw new PrepError('Too few questions survived the guard', 502, "We couldn't build your interview prep. Please try again.")
  return { ...guarded, model: result.model, generatedAt: new Date().toISOString() }
}
