// The two ATS-safe templates. Both are single column with real text and standard section
// headings; they differ only in type and accents. Shared by the HTML preview
// (src/components/flow/resume-document.tsx) and the PDF (src/lib/resume-pdf.tsx).
import { dateRange } from '@/lib/master-resume'
import type { ParsedResume } from '@/types/parsed-resume'

export type TemplateId = 'classic' | 'modern'

export const TEMPLATES: { id: TemplateId; name: string; blurb: string }[] = [
  { id: 'classic', name: 'Classic', blurb: 'Serif, centered header' },
  { id: 'modern', name: 'Modern', blurb: 'Sans, accent headings' },
]

export function isTemplateId(value: unknown): value is TemplateId {
  return value === 'classic' || value === 'modern'
}

export const TEMPLATE_STYLE: Record<TemplateId, { accent: string; rule: string; serif: boolean; centered: boolean }> = {
  classic: { accent: '#111827', rule: '#111827', serif: true, centered: true },
  modern: { accent: '#047857', rule: '#D1D5DB', serif: false, centered: false },
}

/** Everything a template renders, in order, with display strings already built. */
export interface ResumeLayout {
  name: string
  headline: string
  contactItems: string[]
  summary: string
  experience: { key: string; title: string; company: string; location: string; dates: string; bullets: string[] }[]
  projects: { key: string; name: string; url: string; dates: string; bullets: string[]; tech: string }[]
  education: { key: string; school: string; credential: string; dates: string; details: string[] }[]
  skills: { group: string; items: string }[]
  certifications: string[]
  extraSections: { heading: string; items: string[] }[]
}

const clean = (items: string[]) => items.map((s) => s.trim()).filter(Boolean)

export function toLayout(resume: ParsedResume): ResumeLayout {
  const c = resume.contact
  return {
    name: c.fullName,
    headline: c.headline,
    contactItems: clean([c.email, c.phone, c.location, ...c.links.map((l) => l.url.replace(/^https?:\/\/(www\.)?/, ''))]),
    summary: resume.summary,
    experience: resume.experience.map((e) => ({
      key: e.id,
      title: e.title,
      company: e.company,
      location: e.location,
      dates: dateRange(e.startDate, e.endDate, e.current),
      bullets: clean(e.bullets),
    })),
    projects: resume.projects.map((p) => ({
      key: p.id,
      name: p.name,
      url: p.url.replace(/^https?:\/\/(www\.)?/, ''),
      dates: p.dates,
      bullets: clean(p.bullets),
      tech: p.tech.join(', '),
    })),
    education: resume.education.map((e) => ({
      key: e.id,
      school: e.school,
      credential: [e.credential, e.field].filter(Boolean).join(', '),
      dates: dateRange(e.startDate, e.endDate),
      details: clean(e.details),
    })),
    skills: resume.skills.map((g) => ({ group: g.group, items: g.items.join(', ') })),
    certifications: resume.certifications.map((cert) => [cert.name, cert.issuer, cert.date].filter(Boolean).join(' · ')),
    extraSections: resume.extraSections,
  }
}
