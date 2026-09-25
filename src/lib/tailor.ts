// Tailor a master resume to a job post.
//
// Flow: master Resume row -> buildTailorInput (stable ids, bullets as arrays, no contact
// info) -> OpenAI structured output -> factGuard (src/lib/fact-guard.ts) ->
// applyTailorOutput (merge back into the master's own shape, contact info copied).
import OpenAI from 'openai'
import type { TailorInput, TailorOutput } from '@/types/tailor'
import { readSkillGroups } from '@/lib/master-resume'
import { classifyAIError } from '@/lib/ai-errors'
import { recordUsage } from '@/lib/ai-usage'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>

export const DEFAULT_TAILOR_MODEL = 'gpt-4o'

export function tailorModel(): string {
  return process.env.OPENAI_TAILOR_MODEL || DEFAULT_TAILOR_MODEL
}

// The master resume as stored on the Resume row. Shapes vary (older rows use
// role/dates, newer ones jobTitle/startDate/endDate), so everything is read leniently.
export interface MasterResume {
  contactInfo?: unknown
  professionalSummary?: unknown
  workExperience?: unknown
  education?: unknown
  skills?: unknown
  projects?: unknown
  additionalSections?: unknown
}

// ---------- master -> model input ----------

function str(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

function asArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((v) => v && typeof v === 'object') : []
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item : str(item?.text ?? item?.description ?? item?.name)))
    .map((s) => s.trim())
    .filter(Boolean)
}

function splitBullets(text: string): string[] {
  return text
    .split(/\n|•|•/)
    .map((s) => s.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

/** Stable, unique ids per entry. Uses the stored id when there is one. */
function stableIds(entries: AnyRecord[], prefix: string): string[] {
  const used = new Set<string>()
  return entries.map((entry, index) => {
    let id = str(entry.id) || `${prefix}_${index}`
    if (used.has(id)) id = `${id}_${index}`
    used.add(id)
    return id
  })
}

function summaryText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object') return str((value as AnyRecord).summary)
  return ''
}

function skillsList(groups: { items: string[] }[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const skill of groups.flatMap((g) => g.items)) {
    if (skill && !seen.has(skill.toLowerCase())) {
      seen.add(skill.toLowerCase())
      out.push(skill)
    }
  }
  return out
}

function certificationList(additionalSections: unknown): string[] {
  const certs = (additionalSections as AnyRecord | null)?.certifications
  return asArray(certs)
    .map((c) => [str(c.name), str(c.issuer)].filter(Boolean).join(', '))
    .concat(Array.isArray(certs) ? certs.filter((c) => typeof c === 'string').map(str) : [])
    .filter(Boolean)
}

function roleDates(exp: AnyRecord): { startDate: string; endDate: string } {
  const [datesStart, datesEnd] = str(exp.dates).split(/\s+[-–]\s+/)
  const startDate = str(exp.startDate) || str(datesStart)
  let endDate = str(exp.endDate) || str(datesEnd)
  if (!endDate && (exp.isCurrentRole || exp.current)) endDate = 'present'
  return { startDate, endDate }
}

function roleBullets(exp: AnyRecord): string[] {
  const achievements = textList(exp.achievements)
  if (achievements.length > 0) return achievements
  return splitBullets(str(exp.description) || str(exp.responsibilities))
}

export function buildTailorInput(master: MasterResume): TailorInput {
  const roles = asArray(master.workExperience)
  const roleIds = stableIds(roles, 'role')
  const education = asArray(master.education)
  const eduIds = stableIds(education, 'edu')
  const projects = asArray(master.projects)
  const projectIds = stableIds(projects, 'proj')
  const skillGroups = readSkillGroups(master.skills)

  return {
    summary: summaryText(master.professionalSummary),
    roles: roles.map((exp, i) => ({
      id: roleIds[i],
      title: str(exp.jobTitle) || str(exp.role) || str(exp.title) || str(exp.position),
      company: str(exp.company),
      ...roleDates(exp),
      location: str(exp.location),
      bullets: roleBullets(exp),
    })),
    education: education.map((edu, i) => ({
      id: eduIds[i],
      degree: str(edu.degree),
      field: str(edu.field) || str(edu.fieldOfStudy),
      institution: str(edu.institution) || str(edu.school),
      graduationYear: str(edu.graduationYear) || str(edu.year) || str(edu.graduationDate) || str(edu.endDate),
      details: [
        ...textList(edu.details),
        ...textList(edu.honors),
        ...textList(edu.relevantCoursework),
        str(edu.additionalInfo),
      ].filter(Boolean),
    })),
    projects: projects.map((project, i) => ({
      id: projectIds[i],
      name: str(project.name) || str(project.title),
      description: str(project.description),
      technologies: textList(project.technologies ?? project.tech),
      bullets: textList(project.achievements ?? project.bullets),
    })),
    skills: skillsList(skillGroups),
    skillGroups,
    certifications: certificationList(master.additionalSections),
  }
}

// ---------- model call ----------

const bulletSchema = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'The rewritten bullet.' },
    reason: { type: 'string', description: 'Short reason for the change (under 15 words).' },
  },
  required: ['text', 'reason'],
  additionalProperties: false,
}

const TAILOR_SCHEMA = {
  type: 'object',
  properties: {
    targetKeywords: {
      type: 'array',
      description: '10-20 skills/terms extracted from the job description.',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
    roles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          company: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          bullets: { type: 'array', items: bulletSchema },
        },
        required: ['id', 'title', 'company', 'startDate', 'endDate', 'bullets'],
        additionalProperties: false,
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          degree: { type: 'string' },
          institution: { type: 'string' },
          graduationYear: { type: 'string' },
        },
        required: ['id', 'degree', 'institution', 'graduationYear'],
        additionalProperties: false,
      },
    },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          bullets: { type: 'array', items: bulletSchema },
        },
        required: ['id', 'name', 'description', 'bullets'],
        additionalProperties: false,
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
  },
  required: ['targetKeywords', 'summary', 'roles', 'education', 'projects', 'skills'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You are a professional resume writer. You tailor a candidate's real resume to a specific job. You never fabricate anything, and you write in the candidate's natural voice.`

export interface TailorJob {
  title: string
  company: string
  description: string
  location?: string
}

export interface TailorOptions {
  extraContext?: string
  contextTags?: string[]
  client?: OpenAI
  model?: string
}

export function buildTailorPrompt(input: TailorInput, job: TailorJob, options: TailorOptions = {}): string {
  const context =
    options.extraContext || options.contextTags?.length
      ? `
ADDITIONAL CONTEXT FROM THE CANDIDATE:
${options.extraContext ? `Notes: ${options.extraContext}` : ''}
${options.contextTags?.length ? `Tags: ${options.contextTags.join(', ')}` : ''}
Use this to decide emphasis (e.g. career changer: lead with transferable skills). It is not a source of new facts.
`
      : ''

  return `Tailor this resume to the target job.

CANDIDATE RESUME (JSON, the only source of facts):
${JSON.stringify(input, null, 2)}

TARGET JOB:
Title: ${job.title}
Company: ${job.company}
${job.location ? `Location: ${job.location}\n` : ''}Description:
${job.description}
${context}
RULES (all mandatory):
1. Never fabricate. No new employers, titles, dates, schools, degrees, tools, technologies, certifications, responsibilities, or achievements.
2. Only keep numbers that already exist in the resume. Never introduce new metrics, percentages, dollar amounts, team sizes, or counts. If a bullet has no number, do not add one.
3. Never add a tool, technology, or employer the resume doesn't already mention.
4. Do not copy phrases verbatim from the job description. Use natural, adjacent language.
5. Return every role, education entry, and project with the same "id" as the input. Copy title, company, startDate, endDate, degree, institution, graduationYear, and project name exactly as given.
6. Bullets: rewrite each role's bullets to emphasize what matters for this job. Start with a strong action verb, keep each to 1-2 lines. You may reorder bullets by relevance and merge or drop weak ones, but every bullet must be supported by the original bullets for that same role. Keep 3-5 bullets per role when the source has that many.
7. For every bullet, give a short "reason" (under 15 words) for the change, e.g. "Moved up: matches CI/CD requirement".
8. Summary: 2-3 sentences positioning the candidate for this role, using only facts from the resume.
9. Skills: return a flat list, most relevant first. Only include skills that appear in the resume ("skills" and "skillGroups"). You may drop irrelevant ones. The resume's grouping is kept for you.
10. Certifications are facts: mention them in the summary or bullets only if relevant, word for word, never invent one.
11. targetKeywords: extract 10-20 concrete skills/terms from the job description (tools, technologies, domains, methods). Extract them from the job description even if the candidate lacks them.${
    input.evidence?.length
      ? `
12. "evidence" lists facts the candidate confirmed about specific bullets (the bullet is in parentheses). You may use those numbers and outcomes in the bullet they're about, and nowhere else.`
      : ''
  }`
}

export class TailorError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly userMessage: string,
    // AIErrorKind from classifyAIError, or 'bad_output' when the call worked but the
    // response was unusable. Goes on the ai_error event.
    public readonly kind: string = 'bad_output'
  ) {
    super(message)
    this.name = 'TailorError'
  }
}

let defaultClient: OpenAI | null = null
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[OPENAI_NOT_CONFIGURED] OPENAI_API_KEY is not set')
    throw new TailorError('OPENAI_API_KEY is not configured', 503, "Tailoring is temporarily unavailable, we're on it.", 'not_configured')
  }
  defaultClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return defaultClient
}

export async function callTailorModel(
  input: TailorInput,
  job: TailorJob,
  options: TailorOptions = {}
): Promise<{ output: TailorOutput; model: string }> {
  const client = options.client ?? getClient()
  const model = options.model ?? tailorModel()

  let completion
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 8000,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'tailored_resume', strict: true, schema: TAILOR_SCHEMA as unknown as Record<string, unknown> },
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildTailorPrompt(input, job, options) },
      ],
    })
  } catch (error: any) {
    const classified = classifyAIError(error, 'Tailoring')
    throw new TailorError(String(error?.message || 'Unknown OpenAI error'), classified.status, classified.userMessage, classified.kind)
  }
  recordUsage(completion, model)

  const choice = completion.choices[0]
  if (choice?.message?.refusal) {
    throw new TailorError(`Model refused: ${choice.message.refusal}`, 422, "The AI wouldn't tailor for this posting. Check that the job description is a real job ad and try again. This didn't count toward your limit.")
  }
  if (choice?.finish_reason === 'length') {
    throw new TailorError('Model output truncated', 400, "That was too much text to tailor in one go. Trim the job description to the role and requirements and try again. This didn't count toward your limit.")
  }
  const content = choice?.message?.content
  if (!content) {
    throw new TailorError('Empty model response', 502, "We didn't get a usable answer back. Please try again; this didn't count toward your limit.")
  }

  try {
    return { output: JSON.parse(content) as TailorOutput, model: completion.model || model }
  } catch {
    throw new TailorError('Model returned invalid JSON', 502, "We didn't get a usable answer back. Please try again; this didn't count toward your limit.")
  }
}

// ---------- cleaned output -> resume shape ----------

function mergeSkills(masterSkills: unknown, tailored: string[]): unknown {
  const rank = new Map(tailored.map((s, i) => [s.toLowerCase(), i]))
  const byRank = (a: string, b: string) => (rank.get(a.toLowerCase()) ?? 0) - (rank.get(b.toLowerCase()) ?? 0)

  if (Array.isArray(masterSkills) && masterSkills.some((g) => g && typeof g === 'object')) {
    // [{ group, items }]: keep the groups and their order, reorder/filter items inside.
    const groups = readSkillGroups(masterSkills)
    const placed = new Set<string>()
    const result = groups.map((g) => {
      const kept = g.items.filter((s) => rank.has(s.toLowerCase())).sort(byRank)
      kept.forEach((s) => placed.add(s.toLowerCase()))
      return { group: g.group, items: kept }
    })
    // Skills fact-guard allowed because they appear elsewhere in the resume (bullets,
    // project tech, certifications) go in an unlabeled group rather than a wrong one.
    const extra = tailored.filter((s) => !placed.has(s.toLowerCase()))
    if (extra.length > 0) result.push({ group: '', items: extra })
    return result.filter((g) => g.items.length > 0)
  }
  if (!masterSkills || typeof masterSkills !== 'object' || Array.isArray(masterSkills)) {
    return tailored
  }

  // Keep the master's categories; within each keep the tailored order and drop the
  // skills the model left out as irrelevant.
  const placed = new Set<string>()
  const result: AnyRecord = {}
  for (const [category, items] of Object.entries(masterSkills as AnyRecord)) {
    if (!Array.isArray(items)) {
      result[category] = items
      continue
    }
    const kept = items.map(str).filter((s) => s && rank.has(s.toLowerCase()))
    kept.forEach((s) => placed.add(s.toLowerCase()))
    result[category] = kept.sort(byRank)
  }
  // Skills that fact-guard allowed because they appear in bullet text, not in a category
  const extra = tailored.filter((s) => !placed.has(s.toLowerCase()))
  if (extra.length > 0) {
    const target = Array.isArray(result.technical) ? 'technical' : Object.keys(result).find((k) => Array.isArray(result[k])) || 'technical'
    result[target] = [...(result[target] || []), ...extra]
  }
  return result
}

/**
 * Merge fact-guarded output back into a copy of the master. The master keeps its own
 * shape (field names, extra fields); only summary text, bullets, project descriptions
 * and skill order change. Contact info is copied straight from the master.
 */
export function applyTailorOutput(master: MasterResume, input: TailorInput, cleaned: TailorOutput) {
  const clone = <T,>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)))

  const roles = asArray(master.workExperience)
  const rolesById = new Map(cleaned.roles.map((r) => [r.id, r]))
  const workExperience = roles.map((exp, i) => {
    const id = input.roles[i].id
    const tailored = rolesById.get(id)
    return { ...clone(exp), id, achievements: tailored ? tailored.bullets.map((b) => b.text) : textList(exp.achievements) }
  })

  const projects = asArray(master.projects)
  const projectsById = new Map(cleaned.projects.map((p) => [p.id, p]))
  const tailoredProjects = projects.map((project, i) => {
    const id = input.projects[i].id
    const tailored = projectsById.get(id)
    if (!tailored) return { ...clone(project), id }
    return {
      ...clone(project),
      id,
      // Parsed resumes keep project text in bullets; don't let the model add a description
      // the master never had.
      description: str(project.description) ? tailored.description : '',
      achievements: tailored.bullets.map((b) => b.text),
    }
  })

  const education = asArray(master.education).map((edu, i) => ({ ...clone(edu), id: input.education[i].id }))

  const masterSummary = master.professionalSummary
  const professionalSummary =
    masterSummary && typeof masterSummary === 'object'
      ? { ...clone(masterSummary as AnyRecord), summary: cleaned.summary }
      : cleaned.summary
        ? { summary: cleaned.summary, keyStrengths: [], careerLevel: 'mid' }
        : masterSummary ?? null

  return {
    contactInfo: clone(master.contactInfo) ?? null,
    professionalSummary,
    workExperience,
    education,
    skills: mergeSkills(master.skills, cleaned.skills),
    projects: tailoredProjects,
    additionalSections: clone(master.additionalSections) ?? null,
  }
}

export type TailoredResume = ReturnType<typeof applyTailorOutput>
