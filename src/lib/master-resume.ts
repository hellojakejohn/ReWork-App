// Converting between the parser's shape (ParsedResume) and the Resume row's structured
// JSON fields (the "master"). Pure and client-safe.
//
// parsedToMaster: what we store after a parse or an inline edit.
// masterToParsed: read any stored master (including older rows with jobTitle/role,
//   categorized skills objects, etc.) or a tailored copy back into one shape. The UI,
//   the preview and the PDF all render from this.
import type { ParsedResume, ParsedSkillGroup } from '@/types/parsed-resume'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>

export interface MasterFields {
  contactInfo: AnyRecord
  professionalSummary: AnyRecord
  workExperience: AnyRecord[]
  education: AnyRecord[]
  skills: ParsedSkillGroup[]
  projects: AnyRecord[]
  additionalSections: AnyRecord
}

function linkFor(links: { label: string; url: string }[], pattern: RegExp): string {
  return links.find((l) => pattern.test(l.url) || pattern.test(l.label))?.url || ''
}

export function parsedToMaster(resume: ParsedResume): MasterFields {
  const { contact } = resume
  const [firstName = '', ...rest] = contact.fullName.split(/\s+/).filter(Boolean)
  const linkedin = linkFor(contact.links, /linkedin/i)
  const githubUrl = linkFor(contact.links, /github/i)
  const website = contact.links.find((l) => l.url !== linkedin && l.url !== githubUrl)?.url || ''

  return {
    contactInfo: {
      fullName: contact.fullName,
      firstName,
      lastName: rest.join(' '),
      headline: contact.headline,
      email: contact.email,
      phone: contact.phone,
      location: contact.location,
      links: contact.links,
      // Legacy fields some older readers expect
      linkedin,
      githubUrl,
      website,
    },
    professionalSummary: { summary: resume.summary, targetRole: contact.headline },
    workExperience: resume.experience.map((exp) => ({
      id: exp.id,
      jobTitle: exp.title,
      company: exp.company,
      location: exp.location,
      startDate: exp.startDate,
      endDate: exp.current && !exp.endDate ? 'Present' : exp.endDate,
      isCurrentRole: exp.current,
      achievements: exp.bullets,
      technologies: [],
    })),
    education: resume.education.map((edu) => ({
      id: edu.id,
      institution: edu.school,
      degree: edu.credential,
      field: edu.field,
      startDate: edu.startDate,
      graduationYear: edu.endDate,
      details: edu.details,
    })),
    skills: resume.skills,
    projects: resume.projects.map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      dates: p.dates,
      description: '',
      technologies: p.tech,
      achievements: p.bullets,
    })),
    additionalSections: {
      certifications: resume.certifications,
      extraSections: resume.extraSections,
    },
  }
}

// ---------- reading any stored shape ----------

function str(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

function obj(value: unknown): AnyRecord {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' ? (value as AnyRecord) : {}
}

function list(value: unknown): AnyRecord[] {
  const v = typeof value === 'string' ? obj(value) : value
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []
}

function textList(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\n|•/).map((s) => s.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item : str(item?.text ?? item?.name ?? item?.description)))
    .map((s) => s.trim())
    .filter(Boolean)
}

const titleCase = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())

export function readSkillGroups(value: unknown): ParsedSkillGroup[] {
  const v = typeof value === 'string' ? obj(value) : value
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) {
      const items = textList(v)
      return items.length ? [{ group: '', items }] : []
    }
    return v
      .filter((x) => x && typeof x === 'object')
      .map((g: AnyRecord) => ({ group: str(g.group ?? g.name ?? g.category), items: textList(g.items ?? g.skills) }))
      .filter((g) => g.items.length > 0)
  }
  if (v && typeof v === 'object') {
    return Object.entries(v as AnyRecord)
      .map(([group, items]) => ({ group: titleCase(group), items: textList(items) }))
      .filter((g) => g.items.length > 0)
  }
  return []
}

function splitDates(value: string): [string, string] {
  const [a = '', b = ''] = value.split(/\s+[-–—]\s+|\s+to\s+/i)
  return [a.trim(), b.trim()]
}

export function masterToParsed(master: {
  contactInfo?: unknown
  professionalSummary?: unknown
  workExperience?: unknown
  education?: unknown
  skills?: unknown
  projects?: unknown
  additionalSections?: unknown
}): ParsedResume {
  const c = obj(master.contactInfo)
  const fullName = str(c.fullName) || str(c.name) || [str(c.firstName), str(c.lastName)].filter(Boolean).join(' ')
  let links: { label: string; url: string }[] = Array.isArray(c.links)
    ? c.links.map((l: AnyRecord) => ({ label: str(l?.label), url: str(l?.url) })).filter((l: { url: string }) => l.url)
    : []
  if (links.length === 0) {
    links = [
      { label: 'LinkedIn', url: str(c.linkedin) },
      { label: 'GitHub', url: str(c.githubUrl) || str(c.github) },
      { label: 'Website', url: str(c.website) },
    ].filter((l) => l.url)
  }

  const summaryValue = master.professionalSummary
  const summaryObj = obj(summaryValue)
  const summary = typeof summaryValue === 'string' && !summaryValue.trim().startsWith('{') ? summaryValue.trim() : str(summaryObj.summary)

  const additional = obj(master.additionalSections)

  return {
    contact: {
      fullName,
      headline: str(c.headline) || str(c.title) || str(summaryObj.targetRole),
      email: str(c.email),
      phone: str(c.phone),
      location: str(c.location),
      links,
    },
    summary,
    skills: readSkillGroups(master.skills),
    experience: list(master.workExperience).map((exp, i) => {
      const [datesStart, datesEnd] = splitDates(str(exp.dates))
      const endDate = str(exp.endDate) || datesEnd
      const current = !!(exp.isCurrentRole || exp.current) || /^present$/i.test(endDate)
      const achievements = textList(exp.achievements)
      return {
        id: str(exp.id) || `exp_${i}`,
        title: str(exp.jobTitle) || str(exp.title) || str(exp.role) || str(exp.position),
        company: str(exp.company),
        location: str(exp.location),
        startDate: str(exp.startDate) || datesStart,
        endDate: /^present$/i.test(endDate) ? '' : endDate,
        current,
        bullets: achievements.length ? achievements : textList(str(exp.description) || str(exp.responsibilities)),
      }
    }),
    projects: list(master.projects).map((p, i) => ({
      id: str(p.id) || `proj_${i}`,
      name: str(p.name) || str(p.title),
      url: str(p.url),
      dates: str(p.dates) || [str(p.startDate), str(p.endDate)].filter(Boolean).join(' – '),
      bullets: [...(str(p.description) ? [str(p.description)] : []), ...textList(p.achievements)],
      tech: textList(p.technologies ?? p.tech),
    })),
    education: list(master.education).map((edu, i) => ({
      id: str(edu.id) || `edu_${i}`,
      school: str(edu.institution) || str(edu.school),
      credential: str(edu.degree) || str(edu.credential),
      field: str(edu.field) || str(edu.fieldOfStudy),
      startDate: str(edu.startDate),
      endDate: str(edu.graduationYear) || str(edu.endDate) || str(edu.year) || str(edu.graduationDate),
      details: [
        ...textList(edu.details),
        ...(str(edu.gpa) ? [`GPA: ${str(edu.gpa)}`] : []),
        ...textList(edu.honors),
        ...textList(edu.relevantCoursework),
      ],
    })),
    certifications: list(additional.certifications).map((cert) => ({
      name: str(cert.name),
      issuer: str(cert.issuer),
      date: str(cert.date),
    })).filter((cert) => cert.name),
    extraSections: list(additional.extraSections)
      .map((s) => ({ heading: str(s.heading), items: textList(s.items) }))
      .filter((s) => s.heading && s.items.length > 0),
  }
}

/** "Jan 2022 – Present" style range for display. */
export function dateRange(start: string, end: string, current = false): string {
  const to = current ? end || 'Present' : end
  return [start, to].filter(Boolean).join(' – ')
}

export interface ResumeSummaryStats {
  name: string
  headline: string
  roles: number
  projects: number
  topSkills: string[]
}

export function summarizeResume(resume: ParsedResume): ResumeSummaryStats {
  return {
    name: resume.contact.fullName,
    headline: resume.contact.headline || resume.experience[0]?.title || '',
    roles: resume.experience.length,
    projects: resume.projects.length,
    topSkills: resume.skills.flatMap((g) => g.items).slice(0, 6),
  }
}
