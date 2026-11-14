// "Copy for LinkedIn": the tailored resume as plain text, one block per LinkedIn profile
// field (Headline, About, each Experience entry, Skills). No AI, client-safe. LinkedIn's
// limits: headline 220 characters, About 2,600, an experience description 2,000.
import { toLayout } from '@/lib/resume-templates'
import type { ParsedResume } from '@/types/parsed-resume'

export const LINKEDIN_LIMITS = { headline: 220, about: 2600, experience: 2000 } as const

export interface LinkedInBlock {
  id: string
  label: string
  /** Where it goes on LinkedIn. */
  hint: string
  text: string
  /** True when the text is over LinkedIn's limit for that field. */
  tooLong: boolean
}

export function linkedInBlocks(resume: ParsedResume): LinkedInBlock[] {
  const l = toLayout(resume)
  const blocks: LinkedInBlock[] = []
  const add = (id: string, label: string, hint: string, text: string, limit?: number) => {
    const t = text.trim()
    if (t) blocks.push({ id, label, hint, text: t, tooLong: limit ? t.length > limit : false })
  }
  add('headline', 'Headline', 'Under your name. Edit intro.', l.headline, LINKEDIN_LIMITS.headline)
  add('about', 'About', 'Profile, About section.', l.summary, LINKEDIN_LIMITS.about)
  for (const e of l.experience) {
    const label = [e.title, e.company].filter(Boolean).join(' at ') || 'Experience'
    add(`exp-${e.key}`, label, `Experience, the ${e.dates || 'matching'} role's description.`, e.bullets.map((b) => `• ${b}`).join('\n'), LINKEDIN_LIMITS.experience)
  }
  const skills = l.skills.flatMap((g) => g.items.split(',').map((s) => s.trim())).filter(Boolean)
  add('skills', 'Skills', 'Skills section. Add them one at a time; LinkedIn shows your top few.', [...new Set(skills)].join(', '))
  return blocks
}

/** Every block as one text, for a single copy. */
export function linkedInText(blocks: LinkedInBlock[]): string {
  return blocks.map((b) => `${b.label.toUpperCase()}\n${b.text}`).join('\n\n')
}
