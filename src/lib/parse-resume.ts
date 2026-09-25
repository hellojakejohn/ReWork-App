// Resume parsing: file -> structured resume, validated against the file's own text.
//
// PDF: the PDF itself goes to the model as a file input (it sees the layout, which matters
// for two-column and date-column designs) plus cleaned positional text from pdfjs as a
// second input. DOCX and pasted text: text only. Output is strict json_schema, then
// validateParsedResume() drops anything that isn't in the source text.
//
// There is no fallback parser. If the model call fails we say so and the user retries;
// we never invent data to fill the gap.
import type OpenAI from 'openai'
import { getOpenAI } from '@/lib/openai'
import { classifyAIError } from '@/lib/ai-errors'
import { validateParsedResume } from '@/lib/parse-validate'
import { cleanSourceText, extractDocxText, extractPdfText } from '@/lib/resume-source-text'
import type { ParseResult, ParsedResume } from '@/types/parsed-resume'
import { recordUsage } from '@/lib/ai-usage'

export const DEFAULT_PARSE_MODEL = 'gpt-4o'

export function parseModel(): string {
  return process.env.OPENAI_PARSE_MODEL || DEFAULT_PARSE_MODEL
}

export const PARSE_FAILED_MESSAGE = "We couldn't read that file, try again or paste your resume text."

export class ResumeParseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly userMessage: string,
    // AIErrorKind from classifyAIError, or 'bad_output' when the call worked but the
    // response was unusable. Goes on the ai_error event.
    public readonly kind: string = 'bad_output'
  ) {
    super(message)
    this.name = 'ResumeParseError'
  }
}

export type ParseInput =
  | { kind: 'pdf'; buffer: Buffer; filename: string }
  | { kind: 'docx'; buffer: Buffer; filename: string }
  | { kind: 'text'; text: string }

export type ParseStage = 'extracting' | 'reading' | 'checking'

const MIN_SOURCE_CHARS = 80
const MAX_SOURCE_CHARS = 30_000

const str = { type: 'string' } as const
const strList = { type: 'array', items: { type: 'string' } } as const
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

export const PARSE_SCHEMA = obj({
  contact: obj({
    fullName: str,
    headline: { type: 'string', description: 'Professional title under the name, e.g. "Software Engineer". Empty if none.' },
    email: str,
    phone: str,
    location: str,
    links: { type: 'array', items: obj({ label: str, url: str }) },
  }),
  summary: str,
  skills: {
    type: 'array',
    description: 'Skill groups in the order they appear. Use group "" if the resume lists skills without headings.',
    items: obj({ group: str, items: strList }),
  },
  experience: {
    type: 'array',
    items: obj({
      id: { type: 'string', description: 'exp_1, exp_2, ... in document order' },
      title: str,
      company: str,
      location: str,
      startDate: str,
      endDate: { type: 'string', description: 'As written. Empty if current.' },
      current: { type: 'boolean' },
      bullets: strList,
    }),
  },
  projects: {
    type: 'array',
    items: obj({
      id: { type: 'string', description: 'proj_1, proj_2, ...' },
      name: str,
      url: str,
      dates: str,
      bullets: strList,
      tech: strList,
    }),
  },
  education: {
    type: 'array',
    items: obj({
      id: { type: 'string', description: 'edu_1, edu_2, ...' },
      school: str,
      credential: { type: 'string', description: 'Degree, certificate or program, e.g. "B.S." or "Full Stack Web Development".' },
      field: str,
      startDate: str,
      endDate: str,
      details: strList,
    }),
  },
  certifications: { type: 'array', items: obj({ name: str, issuer: str, date: str }) },
  extraSections: {
    type: 'array',
    description: 'Any other section (Awards, Languages, Volunteering, Publications, ...), heading as written.',
    items: obj({ heading: str, items: strList }),
  },
})

const SYSTEM_PROMPT = `You convert a resume into JSON. You copy; you never write.

Rules:
- Every value must come from the resume. Copy text exactly as written (fix only broken spacing). Never infer, complete, or normalize a company, school, title, date, email, phone or URL.
- If something is not in the resume, use "" or []. A missing field is fine; an invented one is a serious error.
- Contact: fullName is the person's name only. headline is the title line near the name (e.g. "Software Engineer"), never the name. email/phone/location are separate fields; the resume may separate them with icons or "|". links are full URLs that appear in the resume (profile/portfolio/GitHub/LinkedIn), labeled by site.
- Experience: one entry per role. Dates may sit in a separate column to the left or right of the role; pair each date range with the role on the same row. Bullets are the role's bullet points, one string each, in order. Put the employer in company and the job title in title.
- Skills: keep the resume's own groups and their order. Items are individual skills.
- Projects: name, link if shown, dates if shown, bullets, and technologies used (only ones written for that project).
- Education: school, credential (degree/certificate/program), field of study, dates, and any detail lines (GPA, honors, coursework).
- Anything else goes in extraSections with its heading.`

function userPrompt(sourceText: string, hasFile: boolean): string {
  return `${hasFile ? 'The attached PDF is the resume. Use it for layout. ' : ''}Below is the text extracted from the resume${
    hasFile ? ' (fields on the same line are separated by " | "; use it to get exact spelling)' : ''
  }.

<resume_text>
${sourceText}
</resume_text>

Return the resume as JSON.`
}

async function sourceTextFor(input: ParseInput): Promise<string> {
  try {
    if (input.kind === 'pdf') return cleanSourceText(await extractPdfText(input.buffer))
    if (input.kind === 'docx') return await extractDocxText(input.buffer)
    return cleanSourceText(input.text)
  } catch (error) {
    console.error('[parse-resume] text extraction failed:', error)
    throw new ResumeParseError(`Text extraction failed: ${String((error as Error)?.message)}`, 422, PARSE_FAILED_MESSAGE, 'unreadable_file')
  }
}

export interface ParseOptions {
  client?: OpenAI
  model?: string
  onStage?: (stage: ParseStage) => void
}

export async function parseResume(input: ParseInput, options: ParseOptions = {}): Promise<ParseResult> {
  options.onStage?.('extracting')
  const sourceText = await sourceTextFor(input)
  if (sourceText.replace(/\s/g, '').length < MIN_SOURCE_CHARS) {
    throw new ResumeParseError(
      `Source text too short (${sourceText.length} chars)`,
      422,
      input.kind === 'text'
        ? 'That text is too short to be a resume. Paste the whole thing.'
        : "We couldn't find any text in that file (it may be a scan or an image). Paste your resume text instead.",
      'too_short'
    )
  }
  if (sourceText.length > MAX_SOURCE_CHARS) {
    throw new ResumeParseError('Source text too long', 413, 'That resume is too long for us to read. Try a shorter version.', 'too_long')
  }

  options.onStage?.('reading')
  const model = options.model ?? parseModel()
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []
  if (input.kind === 'pdf') {
    content.push({
      type: 'file',
      file: { filename: input.filename || 'resume.pdf', file_data: `data:application/pdf;base64,${input.buffer.toString('base64')}` },
    })
  }
  content.push({ type: 'text', text: userPrompt(sourceText, input.kind === 'pdf') })

  let completion
  try {
    const client = options.client ?? getOpenAI()
    completion = await client.chat.completions.create({
      model,
      temperature: 0,
      max_completion_tokens: 8000,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'parsed_resume', strict: true, schema: PARSE_SCHEMA as unknown as Record<string, unknown> },
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    })
  } catch (error) {
    const classified = classifyAIError(error, 'Resume reading')
    const userMessage = classified.kind === 'rate_limit' || classified.kind === 'unavailable' ? PARSE_FAILED_MESSAGE : classified.userMessage
    throw new ResumeParseError(`Parse model call failed: ${String((error as Error)?.message)}`, classified.status, userMessage, classified.kind)
  }
  recordUsage(completion, model)

  const choice = completion.choices[0]
  const raw = choice?.message?.content
  if (choice?.message?.refusal || choice?.finish_reason === 'length' || !raw) {
    throw new ResumeParseError(`Parse model returned no usable output (${choice?.finish_reason})`, 502, PARSE_FAILED_MESSAGE)
  }

  let parsed: ParsedResume
  try {
    parsed = JSON.parse(raw) as ParsedResume
  } catch {
    throw new ResumeParseError('Parse model returned invalid JSON', 502, PARSE_FAILED_MESSAGE)
  }

  options.onStage?.('checking')
  const { resume, needsReview } = validateParsedResume(parsed, sourceText)
  const empty =
    resume.experience.length === 0 && resume.education.length === 0 && resume.projects.length === 0 && !resume.summary && resume.skills.length === 0
  if (empty) {
    throw new ResumeParseError('Parsed resume has no content', 422, PARSE_FAILED_MESSAGE, 'empty')
  }

  return { resume, needsReview, sourceText, model: completion.model || model }
}
