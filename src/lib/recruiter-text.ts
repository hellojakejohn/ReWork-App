// A tailored resume as a recruiter would read it: plain text the cover letter is written
// from. Shared by the cover letter route and the model eval.
import { masterToParsed } from '@/lib/master-resume'
import { toLayout } from '@/lib/resume-templates'

export function recruiterText(structured: unknown): string {
  const l = toLayout(masterToParsed((structured ?? {}) as Record<string, unknown>))
  return [
    l.summary,
    ...l.experience.flatMap((e) => [[e.title, e.company, e.dates].filter(Boolean).join(', '), ...e.bullets.map((b) => `- ${b}`)]),
    ...l.projects.flatMap((p) => [p.name, ...p.bullets.map((b) => `- ${b}`), p.tech]),
    ...l.skills.map((g) => [g.group, g.items].filter(Boolean).join(': ')),
  ]
    .filter(Boolean)
    .join('\n')
}
