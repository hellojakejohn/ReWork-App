// Server-side fact guard for tailor output. Pure functions, no AI.
//
// The model is told not to fabricate, but we don't trust that. After it returns we:
// - restore company/title/dates (and education/project facts) to the master values
// - restore entries the model dropped, discard entries it invented
// - revert any bullet/summary that introduces a number not present in the master
// - drop skills that don't appear anywhere in the master
import type {
  FactGuardResult,
  FactGuardWarning,
  TailorInput,
  TailorInputRole,
  TailoredBullet,
  TailorOutput,
  TailorOutputEducation,
  TailorOutputProject,
  TailorOutputRole,
} from '@/types/tailor'
import { containsTerm, extractNumberTokens, normalizeSpace, tailorInputText } from '@/lib/resume-text'

const MAX_KEYWORDS = 20

function sameText(a: string, b: string): boolean {
  return normalizeSpace(a).toLowerCase() === normalizeSpace(b).toLowerCase()
}

function newNumbers(text: string, masterNumbers: Set<string>): string[] {
  return extractNumberTokens(text).filter((token) => !masterNumbers.has(token))
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2))
}

/** Master bullet that the tailored bullet most likely rewrote (by word overlap). */
function closestMasterBullet(text: string, candidates: string[]): string | undefined {
  const target = words(text)
  let best: string | undefined
  let bestScore = -1
  for (const candidate of candidates) {
    const other = words(candidate)
    let overlap = 0
    for (const w of target) if (other.has(w)) overlap++
    const score = overlap / Math.max(1, target.size + other.size - overlap)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

function guardBullets(
  bullets: TailoredBullet[],
  masterBullets: string[],
  masterNumbers: Set<string>,
  section: 'roles' | 'projects',
  id: string,
  warnings: FactGuardWarning[]
): TailoredBullet[] {
  const cleaned: TailoredBullet[] = []
  for (const bullet of bullets) {
    const text = normalizeSpace(bullet.text || '')
    if (!text) continue
    const introduced = newNumbers(text, masterNumbers)
    if (introduced.length === 0) {
      cleaned.push({ text, reason: bullet.reason || '' })
      continue
    }
    const original = closestMasterBullet(text, masterBullets)
    const alreadyUsed = original !== undefined && cleaned.some((b) => b.text === original)
    warnings.push({
      type: 'new_number',
      section,
      id,
      message: `Bullet introduced numbers not in your resume (${introduced.join(', ')}); ${
        original && !alreadyUsed ? 'reverted to your original bullet' : 'removed'
      }.`,
      attempted: text,
      restored: original && !alreadyUsed ? original : undefined,
    })
    if (original && !alreadyUsed) {
      cleaned.push({ text: original, reason: 'Reverted: rewrite introduced a number not in your resume' })
    }
  }
  if (cleaned.length === 0 && masterBullets.length > 0) {
    return masterBullets.map((text) => ({ text, reason: 'Unchanged from your resume' }))
  }
  return cleaned
}

function restoreFact(
  field: string,
  attempted: string,
  master: string,
  section: FactGuardWarning['section'],
  id: string,
  label: string,
  warnings: FactGuardWarning[]
): string {
  if (!sameText(attempted || '', master || '')) {
    warnings.push({
      type: 'fact_restored',
      section,
      id,
      message: `${label}: ${field} was changed to "${attempted}"; restored "${master}".`,
      attempted,
      restored: master,
    })
  }
  return master
}

function guardRoles(master: TailorInput, output: TailorOutput, masterNumbers: Set<string>, warnings: FactGuardWarning[]) {
  const outputById = new Map<string, TailorOutputRole>()
  for (const role of output.roles || []) {
    if (!master.roles.some((m) => m.id === role.id)) {
      warnings.push({
        type: 'entry_discarded',
        section: 'roles',
        id: role.id,
        message: `Discarded a role the model invented: ${role.title} at ${role.company}.`,
        attempted: `${role.title} at ${role.company}`,
      })
      continue
    }
    if (!outputById.has(role.id)) outputById.set(role.id, role)
  }

  // Master order wins; roles are chronological facts, not something to rank.
  return master.roles.map((m: TailorInputRole): TailorOutputRole => {
    const role = outputById.get(m.id)
    if (!role) {
      warnings.push({
        type: 'entry_restored',
        section: 'roles',
        id: m.id,
        message: `The model dropped ${m.title} at ${m.company}; restored it from your resume.`,
        restored: `${m.title} at ${m.company}`,
      })
      return {
        id: m.id,
        title: m.title,
        company: m.company,
        startDate: m.startDate,
        endDate: m.endDate,
        bullets: m.bullets.map((text) => ({ text, reason: 'Restored from your resume' })),
      }
    }
    const label = `${m.title} at ${m.company}`
    return {
      id: m.id,
      title: restoreFact('title', role.title, m.title, 'roles', m.id, label, warnings),
      company: restoreFact('company', role.company, m.company, 'roles', m.id, label, warnings),
      startDate: restoreFact('start date', role.startDate, m.startDate, 'roles', m.id, label, warnings),
      endDate: restoreFact('end date', role.endDate, m.endDate, 'roles', m.id, label, warnings),
      bullets: guardBullets(role.bullets || [], m.bullets, masterNumbers, 'roles', m.id, warnings),
    }
  })
}

function guardEducation(master: TailorInput, output: TailorOutput, warnings: FactGuardWarning[]) {
  const outputById = new Map<string, TailorOutputEducation>()
  for (const edu of output.education || []) {
    if (!master.education.some((m) => m.id === edu.id)) {
      warnings.push({
        type: 'entry_discarded',
        section: 'education',
        id: edu.id,
        message: `Discarded an education entry the model invented: ${edu.degree} at ${edu.institution}.`,
        attempted: `${edu.degree} at ${edu.institution}`,
      })
      continue
    }
    if (!outputById.has(edu.id)) outputById.set(edu.id, edu)
  }

  return master.education.map((m): TailorOutputEducation => {
    const edu = outputById.get(m.id)
    if (!edu) {
      warnings.push({
        type: 'entry_restored',
        section: 'education',
        id: m.id,
        message: `The model dropped ${m.degree} at ${m.institution}; restored it from your resume.`,
        restored: `${m.degree} at ${m.institution}`,
      })
      return { id: m.id, degree: m.degree, institution: m.institution, graduationYear: m.graduationYear }
    }
    const label = `${m.degree} at ${m.institution}`
    return {
      id: m.id,
      degree: restoreFact('degree', edu.degree, m.degree, 'education', m.id, label, warnings),
      institution: restoreFact('school', edu.institution, m.institution, 'education', m.id, label, warnings),
      graduationYear: restoreFact('graduation year', edu.graduationYear, m.graduationYear, 'education', m.id, label, warnings),
    }
  })
}

function guardProjects(master: TailorInput, output: TailorOutput, masterNumbers: Set<string>, warnings: FactGuardWarning[]) {
  const outputById = new Map<string, TailorOutputProject>()
  for (const project of output.projects || []) {
    if (!master.projects.some((m) => m.id === project.id)) {
      warnings.push({
        type: 'entry_discarded',
        section: 'projects',
        id: project.id,
        message: `Discarded a project the model invented: ${project.name}.`,
        attempted: project.name,
      })
      continue
    }
    if (!outputById.has(project.id)) outputById.set(project.id, project)
  }

  return master.projects.map((m): TailorOutputProject => {
    const project = outputById.get(m.id)
    if (!project) {
      warnings.push({
        type: 'entry_restored',
        section: 'projects',
        id: m.id,
        message: `The model dropped the project ${m.name}; restored it from your resume.`,
        restored: m.name,
      })
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        bullets: m.bullets.map((text) => ({ text, reason: 'Restored from your resume' })),
      }
    }

    let description = normalizeSpace(project.description || '') || m.description
    const introduced = newNumbers(description, masterNumbers)
    if (introduced.length > 0) {
      warnings.push({
        type: 'new_number',
        section: 'projects',
        id: m.id,
        message: `Project description for ${m.name} introduced numbers not in your resume (${introduced.join(', ')}); reverted.`,
        attempted: description,
        restored: m.description,
      })
      description = m.description
    }

    return {
      id: m.id,
      name: restoreFact('name', project.name, m.name, 'projects', m.id, m.name, warnings),
      description,
      bullets: guardBullets(project.bullets || [], m.bullets, masterNumbers, 'projects', m.id, warnings),
    }
  })
}

function guardSummary(master: TailorInput, output: TailorOutput, masterNumbers: Set<string>, warnings: FactGuardWarning[]) {
  const summary = normalizeSpace(output.summary || '')
  if (!summary) return master.summary
  const introduced = newNumbers(summary, masterNumbers)
  if (introduced.length === 0) return summary
  warnings.push({
    type: 'new_number',
    section: 'summary',
    message: `Summary introduced numbers not in your resume (${introduced.join(', ')}); reverted to your original summary.`,
    attempted: summary,
    restored: master.summary,
  })
  return master.summary
}

function guardSkills(master: TailorInput, output: TailorOutput, masterText: string, warnings: FactGuardWarning[]) {
  const kept: string[] = []
  const dropped: string[] = []
  const seen = new Set<string>()
  for (const raw of output.skills || []) {
    const skill = normalizeSpace(raw || '')
    const key = skill.toLowerCase()
    if (!skill || seen.has(key)) continue
    seen.add(key)
    const inMaster = master.skills.some((s) => sameText(s, skill)) || containsTerm(masterText, skill)
    if (inMaster) kept.push(skill)
    else dropped.push(skill)
  }
  if (dropped.length > 0) {
    warnings.push({
      type: 'skill_dropped',
      section: 'skills',
      message: `Dropped skills not found anywhere in your resume: ${dropped.join(', ')}.`,
      attempted: dropped.join(', '),
    })
  }
  return kept.length > 0 ? kept : [...master.skills]
}

function cleanKeywords(keywords: string[]): string[] {
  const seen = new Set<string>()
  const cleaned: string[] = []
  for (const raw of keywords || []) {
    const keyword = normalizeSpace(raw || '')
    const key = keyword.toLowerCase()
    if (!keyword || seen.has(key)) continue
    seen.add(key)
    cleaned.push(keyword)
  }
  return cleaned.slice(0, MAX_KEYWORDS)
}

export function factGuard(master: TailorInput, output: TailorOutput): FactGuardResult {
  const warnings: FactGuardWarning[] = []
  const masterText = tailorInputText(master)
  const masterNumbers = new Set(extractNumberTokens(masterText))

  const cleaned: TailorOutput = {
    targetKeywords: cleanKeywords(output.targetKeywords),
    summary: guardSummary(master, output, masterNumbers, warnings),
    roles: guardRoles(master, output, masterNumbers, warnings),
    education: guardEducation(master, output, warnings),
    projects: guardProjects(master, output, masterNumbers, warnings),
    skills: guardSkills(master, output, masterText, warnings),
  }

  return { cleaned, warnings }
}
