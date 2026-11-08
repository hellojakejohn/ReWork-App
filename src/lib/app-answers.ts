// Application answers: "Why do you want to work here?" and the like, answered only from
// the candidate's resume. Same safety as the cover letter: structured output, the prose
// fact guard (src/lib/text-facts.ts), one regenerate with the problems spelled out, then
// any sentence that still claims something not in the resume is dropped and reported.
// Questions the resume can't answer (salary, start date, visa) come back as "needsYou".
// Runs on the cover letter model (task 'coverLetter'): same kind of writing.
import { randomUUID } from 'crypto'
import { AIOutputError, classifyAIError } from '@/lib/ai-errors'
import { callOverrides, generateStructured, type AICallOptions } from '@/lib/ai'
import { normalizeSpace } from '@/lib/resume-text'
import { describeFacts, dropUnsupportedSentences, hasUnsupported, splitSentences, unsupportedFacts } from '@/lib/text-facts'
import { allowedSourceText, bannedPhrasesIn, countWords, type CoverLetterJob } from '@/lib/cover-letter'
import { ANSWER_LENGTHS, type AnswerLength, type AnswerWarning, type StoredAnswer } from '@/lib/app-answers-shared'
import type { TailorInput } from '@/types/tailor'

export * from '@/lib/app-answers-shared'

export interface AnswerInput {
  master: TailorInput
  tailoredText: string
  candidateName: string
  job: CoverLetterJob
  question: string
  length: AnswerLength
  extraFacts?: string[]
}

interface AnswerDraft {
  answer: string
  needsYou: string
}

const SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'The answer, first person, ready to paste. Plain text, no headings.' },
    needsYou: {
      type: 'string',
      description:
        'Empty string, unless the question asks for something the resume cannot answer (salary, start date, visa or work authorization, references, availability, a personal opinion or story not in the resume). Then one short sentence telling the candidate what to add.',
    },
  },
  required: ['answer', 'needsYou'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You help job seekers answer application questions using only their real resume. You never invent experience, numbers, employers or tools. You write plainly, like a person.`

export function wordRange(length: AnswerLength): [number, number] {
  return ANSWER_LENGTHS.find((l) => l.id === length)!.words
}

export function buildAnswerPrompt(input: AnswerInput, feedback: string[] = []): string {
  const [min, max] = wordRange(input.length)
  const facts = input.extraFacts?.length ? `\nCANDIDATE-CONFIRMED FACTS (usable like resume facts):\n${input.extraFacts.map((f) => `- ${f}`).join('\n')}\n` : ''
  return `Answer this job application question for the candidate.

QUESTION:
${input.question}

RESUME (JSON, the only source of facts about the candidate):
${JSON.stringify(input.master)}
${facts}
TAILORED RESUME FOR THIS JOB (what to emphasize; same facts):
${input.tailoredText}

TARGET JOB:
Title: ${input.job.title}
Company: ${input.job.company}
Description:
${input.job.description}

RULES (all mandatory):
1. ${min}-${max} words. First person. Answer the question that was asked, directly, in the first sentence.
2. Never fabricate. Only mention employers, schools, tools, credentials and numbers that appear in the resume or the confirmed facts. No invented metrics, team sizes or years.
3. Connect the candidate's real experience to what this job needs. You may name the company and things the job description says about the role or company.
4. If the question needs something the resume can't answer (salary expectations, start date, visa or work authorization, relocation, references, a personal story), don't guess: write what you honestly can and put a short note in needsYou saying what they should add. Otherwise needsYou is "".
5. No stock phrases: ${['passionate about', 'perfect fit', 'ideal candidate', 'proven track record', 'team player', 'fast-paced environment', 'hit the ground running', 'results-driven'].map((p) => `"${p}"`).join(', ')}.
6. No bullet points, headings, greetings, sign-offs or placeholders like [Company].
7. Punctuation: no em-dashes. Use commas, colons or periods.${
    feedback.length
      ? `

YOUR PREVIOUS ANSWER HAD THESE PROBLEMS. FIX ALL OF THEM:
${feedback.map((f) => `- ${f}`).join('\n')}`
      : ''
  }`
}

// ---------- checks (pure) ----------

export interface AnswerProblems {
  banned: string[]
  facts: string
  words: number
}

export function checkAnswer(answer: string, allowedText: string, jobDescription: string, length: AnswerLength): { problems: AnswerProblems; bad: boolean } {
  const facts = unsupportedFacts(answer, allowedText, jobDescription)
  const words = countWords(answer)
  const [min, max] = wordRange(length)
  const problems = { banned: bannedPhrasesIn(answer), facts: hasUnsupported(facts) ? describeFacts(facts) : '', words }
  return { problems, bad: problems.banned.length > 0 || !!problems.facts || words < min * 0.6 || words > max * 1.3 }
}

export function answerFeedback(p: AnswerProblems, length: AnswerLength): string[] {
  const [min, max] = wordRange(length)
  const out: string[] = []
  if (p.banned.length) out.push(`Remove these stock phrases: ${p.banned.map((b) => `"${b}"`).join(', ')}.`)
  if (p.facts) out.push(`It mentions things not in the resume (${p.facts}). Remove them or use only resume facts.`)
  if (p.words < min * 0.6) out.push(`Too short (${p.words} words). Aim for ${min}-${max}.`)
  if (p.words > max * 1.3) out.push(`Too long (${p.words} words). Aim for ${min}-${max}.`)
  return out
}

/** Em-dashes out (house rule), sentences with banned phrases or unsupported facts dropped. */
export function guardAnswer(answer: string, allowedText: string, jobDescription: string, length: AnswerLength): { answer: string; warnings: AnswerWarning[] } {
  const warnings: AnswerWarning[] = []
  const cleaned = normalizeSpace(answer.replace(/\s*[—–]\s*/g, ', ').replace(/\n{2,}/g, '\n'))
  const kept: string[] = []
  for (const sentence of splitSentences(cleaned)) {
    const banned = bannedPhrasesIn(sentence)
    if (banned.length) {
      warnings.push({ type: 'banned_phrase', message: `Removed a stock phrase ("${banned[0]}").`, attempted: sentence })
      continue
    }
    const { removed } = dropUnsupportedSentences(sentence, allowedText, jobDescription)
    if (removed.length) {
      warnings.push({ type: 'unsupported_fact', message: `Removed a sentence that mentioned things not in your resume (${describeFacts(removed[0].facts)}).`, attempted: sentence })
      continue
    }
    kept.push(sentence)
  }
  const out = kept.join(' ')
  const [min] = wordRange(length)
  if (out && countWords(out) < min * 0.5) warnings.push({ type: 'length', message: 'The answer is short after the fact check. Add a line of your own or try again.' })
  return { answer: out, warnings }
}

// ---------- model call ----------

export class AnswerError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly userMessage: string,
    public readonly kind: string = 'invalid_output'
  ) {
    super(message)
    this.name = 'AnswerError'
  }
}

async function callModel(options: AICallOptions, prompt: string): Promise<{ draft: AnswerDraft; model: string }> {
  try {
    const result = await generateStructured<AnswerDraft>({
      task: 'coverLetter',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      schema: SCHEMA as unknown as Record<string, unknown>,
      schemaName: 'application_answer',
      maxTokens: 900,
      temperature: 0.5,
      effort: 'medium',
      ...callOverrides('coverLetter', options),
    })
    return { draft: result.data, model: result.model }
  } catch (error) {
    if (error instanceof AIOutputError) {
      throw new AnswerError(error.message, error.reason === 'refusal' ? 422 : 502, "We couldn't answer that question. Try rewording it.", 'invalid_output')
    }
    const classified = classifyAIError(error, 'Answers')
    throw new AnswerError(String((error as Error)?.message || 'Unknown AI error'), classified.status, classified.userMessage, classified.kind)
  }
}

export async function generateAnswer(input: AnswerInput, options: AICallOptions = {}): Promise<StoredAnswer> {
  const allowedText = allowedSourceText(input)
  const warnings: AnswerWarning[] = []
  let result = await callModel(options, buildAnswerPrompt(input))
  const first = checkAnswer(result.draft.answer, allowedText, input.job.description, input.length)
  if (first.bad) {
    const feedback = answerFeedback(first.problems, input.length)
    try {
      result = await callModel(options, buildAnswerPrompt(input, feedback))
      warnings.push({ type: 'regenerated', message: `Rewrote the answer once: ${feedback.join(' ')}` })
    } catch (error) {
      console.error('[app-answers] retry failed, guarding the first draft:', (error as Error)?.message)
    }
  }
  const guarded = guardAnswer(result.draft.answer, allowedText, input.job.description, input.length)
  if (!guarded.answer) throw new AnswerError('Nothing left after the fact check', 422, "We couldn't answer that from your resume alone. Add the details to your resume, or write this one yourself.", 'invalid_output')
  const needsYou = normalizeSpace(result.draft.needsYou || '').replace(/\s*[—–]\s*/g, ', ')
  return {
    id: randomUUID(),
    question: input.question,
    answer: guarded.answer,
    length: input.length,
    needsYou: needsYou || null,
    warnings: [...warnings, ...guarded.warnings],
    model: result.model,
    generatedAt: new Date().toISOString(),
    edited: false,
  }
}
