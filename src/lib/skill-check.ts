// Skill check: the honest way to raise keyword coverage. Before tailoring, list the job's
// keywords the resume doesn't show and ask the user about each (No / A little / Yes, plus
// where or how). Their answers, never the model's guesses, become resume text.
//
// 1. extractJobKeywords: the model lists the job's 10-20 target keywords (same rule as the
//    tailor's targetKeywords). fitCoverage scores the master against them. Pure after that.
// 2. placeSkills: the model decides where each answer belongs (skills, a bullet on a role
//    or project, or Training) and words it from the user's note only. guardAddition
//    re-checks every addition: the keyword must be in it, every fact must come from the
//    user's note, and "A little" can't turn into "expert". Anything that fails becomes a
//    plain skill (the user did say yes) or is dropped.
// 3. applySkillAdditions: writes accepted additions into the MASTER after an explicit Add.
import { AIOutputError, classifyAIError } from '@/lib/ai-errors'
import { callOverrides, generateStructured, type AICallOptions } from '@/lib/ai'
import { keywordCoverage, hasKeyword } from '@/lib/keyword-coverage'
import { parsedToMaster } from '@/lib/master-resume'
import { buildTailorInput } from '@/lib/tailor'
import { normalizeSpace, tailorInputText } from '@/lib/resume-text'
import { hasUnsupported, unsupportedFacts } from '@/lib/text-facts'
import {
  MAX_SKILL_NOTE,
  MAX_SKILL_QUESTIONS,
  TRAINING_HEADING,
  type FitCoverage,
  type SkillAddition,
  type SkillAnswer,
} from '@/lib/skill-check-shared'
import type { ParsedResume } from '@/types/parsed-resume'

export * from '@/lib/skill-check-shared'

export class SkillCheckError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly userMessage: string,
    public readonly kind: string = 'invalid_output'
  ) {
    super(message)
    this.name = 'SkillCheckError'
  }
}

async function structured<T>(options: AICallOptions, name: string, schema: object, system: string, prompt: string): Promise<T> {
  try {
    const result = await generateStructured<T>({
      task: 'evidence',
      system,
      messages: [{ role: 'user', content: prompt }],
      schema: schema as Record<string, unknown>,
      schemaName: name,
      maxTokens: 2000,
      temperature: 0.2,
      effort: 'low',
      ...callOverrides('evidence', options),
    })
    return result.data
  } catch (error) {
    if (error instanceof AIOutputError) {
      throw new SkillCheckError(error.message, 502, 'Something went wrong. Please try again.')
    }
    const classified = classifyAIError(error, 'The skill check')
    throw new SkillCheckError(String((error as Error)?.message || 'Unknown AI error'), classified.status, classified.userMessage, classified.kind)
  }
}

// ---------- 1. keywords and fit ----------

const KEYWORDS_SCHEMA = {
  type: 'object',
  properties: { keywords: { type: 'array', items: { type: 'string' } } },
  required: ['keywords'],
  additionalProperties: false,
} as const

export function buildKeywordsPrompt(job: { title: string; company: string; description: string }): string {
  return `List the 10-20 concrete skills and terms this job asks for (tools, technologies, domains, methods), most important first. One term each, 1-3 words, spelled as the job description spells it ("ERC-721", "user research"), never a phrase joining two ("gas and nonces", "Figma / Sketch"). No soft skills ("communication", "team player") and no job titles.

JOB: ${job.title} at ${job.company}
${job.description}`
}

export function cleanKeywords(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const k of raw) {
    const keyword = normalizeSpace(String(k)).replace(/^[-*\d.)\s]+/, '').replace(/[.,;:]+$/, '')
    if (!keyword || keyword.length > 40 || keyword.split(' ').length > 4) continue
    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(keyword)
  }
  return out.slice(0, 20)
}

export async function extractJobKeywords(job: { title: string; company: string; description: string }, options: AICallOptions = {}): Promise<string[]> {
  const output = await structured<{ keywords: string[] }>(
    options,
    'job_keywords',
    KEYWORDS_SCHEMA,
    'You read job postings and list the skills they ask for, exactly as written.',
    buildKeywordsPrompt(job)
  )
  return cleanKeywords(output.keywords ?? [])
}

/** The same text the tailor scores "before" against, so the two numbers agree. */
export function resumeKeywordText(resume: ParsedResume): string {
  return tailorInputText(buildTailorInput(parsedToMaster(resume) as never))
}

export function fitCoverage(keywords: string[], resume: ParsedResume): FitCoverage {
  return keywordCoverage(keywords, resumeKeywordText(resume))
}

// ---------- 2. placing answers ----------

/** Answers worth placing: a known missing keyword, Yes or A little, note trimmed and capped. */
export function cleanAnswers(raw: unknown, allowedKeywords: string[]): SkillAnswer[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Map(allowedKeywords.map((k) => [k.toLowerCase(), k]))
  const seen = new Set<string>()
  const out: SkillAnswer[] = []
  for (const a of raw as SkillAnswer[]) {
    if (!a || typeof a.keyword !== 'string') continue
    const keyword = allowed.get(normalizeSpace(a.keyword).toLowerCase())
    if (!keyword || seen.has(keyword) || (a.level !== 'yes' && a.level !== 'some')) continue
    seen.add(keyword)
    out.push({ keyword, level: a.level, note: normalizeSpace(typeof a.note === 'string' ? a.note : '').slice(0, MAX_SKILL_NOTE) })
    if (out.length >= MAX_SKILL_QUESTIONS) break
  }
  return out
}

const PLACE_SCHEMA = {
  type: 'object',
  properties: {
    additions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'The keyword, copied exactly.' },
          kind: { type: 'string', enum: ['skill', 'bullet', 'training'] },
          target: { type: 'string', description: 'skill: an existing skills group name, or "" for a new one. bullet: the role or project id. training: "".' },
          text: { type: 'string', description: 'skill: the keyword. bullet or training: one line.' },
        },
        required: ['keyword', 'kind', 'target', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['additions'],
  additionalProperties: false,
} as const

const PLACE_SYSTEM = `You add a job seeker's own answers to their resume. You use only what they told you. You never add a fact, number, tool, employer, duration or level of skill they didn't state.`

function entryList(resume: ParsedResume): { id: string; label: string; kind: 'role' | 'project'; bullets: string[] }[] {
  return [
    ...resume.experience.map((e) => ({ id: e.id, label: [e.title, e.company].filter(Boolean).join(' at '), kind: 'role' as const, bullets: e.bullets })),
    ...resume.projects.map((p) => ({ id: p.id, label: p.name, kind: 'project' as const, bullets: p.bullets })),
  ]
}

export function buildPlacePrompt(resume: ParsedResume, answers: SkillAnswer[]): string {
  const groups = resume.skills.map((g) => g.group).filter(Boolean)
  return `Place each answer on the resume.

RESUME ENTRIES:
${entryList(resume)
  .map((e) => `- id: ${e.id} (${e.kind}) ${e.label}`)
  .join('\n') || '(none)'}
SKILLS GROUPS: ${groups.length ? groups.join(' | ') : '(one ungrouped list)'}

ANSWERS:
${answers.map((a) => `- keyword: ${a.keyword}\n  level: ${a.level === 'yes' ? 'yes' : 'a little'}\n  note: ${a.note || '(none)'}`).join('\n')}

RULES:
1. One addition per answer. Copy the keyword exactly.
2. kind "bullet" only when the note describes work on one of the entries above (target is its id). Start with an action verb, past tense, one line.
3. kind "training" when the note describes a class, course, bootcamp, certification or self-study. One line, like "Figma fundamentals (3-hour course, University of X)".
4. Otherwise kind "skill": text is the keyword, target is the best-fitting skills group or "".
5. Use only words from the note and the keyword. Never add numbers, durations, tools, places or outcomes the note doesn't state. A "a little" answer never says expert, advanced, extensive or proficient.
6. The keyword must appear in the text. No em-dashes.`
}

const OVERSTATED = /\b(expert|expertise|advanced|extensive|extensively|deep|mastery|master|proficient|proficiency|senior|seasoned|strong)\b/i

export function guardAddition(resume: ParsedResume, answer: SkillAnswer, raw: { kind: string; target: string; text: string }): SkillAddition {
  const asSkill = skillAddition(resume, answer.keyword, raw.kind === 'skill' ? raw.target : '')
  if (raw.kind !== 'bullet' && raw.kind !== 'training') return asSkill
  // A bullet or a Training line needs the user's own words to come from.
  if (!answer.note) return asSkill
  const text = normalizeSpace(raw.text).replace(/^[-•*]\s*/, '').replace(/\s*[–—]\s*/g, ', ')
  if (!text || text.length > 220 || !hasKeyword(text, answer.keyword)) return asSkill
  if (OVERSTATED.test(text) && !OVERSTATED.test(answer.note)) return asSkill
  const entry = raw.kind === 'bullet' ? entryList(resume).find((e) => e.id === raw.target) : null
  if (raw.kind === 'bullet' && !entry) return asSkill
  // Allowed: the user's note and the keyword. The entry's own name may be repeated.
  const allowed = [answer.note, answer.keyword, entry?.label ?? ''].join('\n')
  if (hasUnsupported(unsupportedFacts(text, allowed))) return asSkill
  return entry
    ? { keyword: answer.keyword, kind: 'bullet', target: entry.id, targetLabel: entry.label, text }
    : { keyword: answer.keyword, kind: 'training', target: '', targetLabel: TRAINING_HEADING, text }
}

function skillAddition(resume: ParsedResume, keyword: string, group: string): SkillAddition {
  const groups = resume.skills.map((g) => g.group)
  const target = groups.find((g) => g && g.toLowerCase() === group.trim().toLowerCase()) ?? groups[0] ?? ''
  return { keyword, kind: 'skill', target, targetLabel: target ? `Skills: ${target}` : 'Skills', text: keyword }
}

/** Without the model (it failed, or AI is paused): every answer becomes a plain skill. */
export function fallbackAdditions(resume: ParsedResume, answers: SkillAnswer[]): SkillAddition[] {
  return answers.map((a) => skillAddition(resume, a.keyword, ''))
}

export async function placeSkills(resume: ParsedResume, answers: SkillAnswer[], options: AICallOptions = {}): Promise<SkillAddition[]> {
  if (answers.length === 0) return []
  // Bare answers (no note) can only ever be skills: no need to ask the model about them.
  const noted = answers.filter((a) => a.note)
  let placed: { keyword: string; kind: string; target: string; text: string }[] = []
  if (noted.length > 0) {
    const output = await structured<{ additions: typeof placed }>(options, 'skill_additions', PLACE_SCHEMA, PLACE_SYSTEM, buildPlacePrompt(resume, noted))
    placed = output.additions ?? []
  }
  const byKeyword = new Map(placed.map((p) => [normalizeSpace(p.keyword).toLowerCase(), p]))
  return answers.map((a) => {
    const raw = byKeyword.get(a.keyword.toLowerCase())
    return raw ? guardAddition(resume, a, raw) : skillAddition(resume, a.keyword, '')
  })
}

// ---------- 3. apply to the master (pure) ----------

export function applySkillAdditions(resume: ParsedResume, additions: SkillAddition[]): { resume: ParsedResume; applied: number } {
  const next: ParsedResume = JSON.parse(JSON.stringify(resume))
  let applied = 0
  for (const a of additions) {
    if (a.kind === 'skill') {
      if (next.skills.some((g) => g.items.some((i) => i.toLowerCase() === a.text.toLowerCase()))) continue
      const group = next.skills.find((g) => g.group === a.target) ?? next.skills[0]
      if (group) group.items.push(a.text)
      else next.skills.push({ group: '', items: [a.text] })
      applied++
    } else if (a.kind === 'bullet') {
      const entry = next.experience.find((e) => e.id === a.target) ?? next.projects.find((p) => p.id === a.target)
      if (!entry || entry.bullets.some((b) => normalizeSpace(b).toLowerCase() === a.text.toLowerCase())) continue
      entry.bullets.push(a.text)
      applied++
    } else {
      let section = next.extraSections.find((s) => /^(training|courses|coursework|professional development)$/i.test(s.heading.trim()))
      if (!section) {
        section = { heading: TRAINING_HEADING, items: [] }
        next.extraSections.push(section)
      }
      if (section.items.some((i) => normalizeSpace(i).toLowerCase() === a.text.toLowerCase())) continue
      section.items.push(a.text)
      applied++
    }
  }
  return { resume: next, applied }
}
