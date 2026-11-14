import { describe, expect, it } from 'vitest'
import { linkedInBlocks, linkedInText } from '@/lib/linkedin-text'
import type { ParsedResume } from '@/types/parsed-resume'

const resume: ParsedResume = {
  contact: { fullName: 'Ada Lovelace', headline: 'Senior Software Engineer', email: 'a@x.com', phone: '', location: '', links: [] },
  summary: 'Engineer who ships payments systems.',
  skills: [
    { group: 'Languages', items: ['TypeScript', 'Go'] },
    { group: 'Tools', items: ['Postgres', 'TypeScript'] },
  ],
  experience: [
    { id: 'e1', title: 'Engineer', company: 'Acme', location: '', startDate: '2021', endDate: '', current: true, bullets: ['Built the ledger', ' '] },
    { id: 'e2', title: 'Intern', company: 'Beta', location: '', startDate: '2020', endDate: '2020', current: false, bullets: [] },
  ],
  projects: [],
  education: [],
  certifications: [],
  extraSections: [],
}

describe('linkedInBlocks', () => {
  it('makes one block per LinkedIn field and skips empty ones', () => {
    const blocks = linkedInBlocks(resume)
    expect(blocks.map((b) => b.label)).toEqual(['Headline', 'About', 'Engineer at Acme', 'Skills'])
    expect(blocks[2].text).toBe('• Built the ledger')
    expect(blocks[3].text).toBe('TypeScript, Go, Postgres')
    expect(blocks.every((b) => !b.tooLong)).toBe(true)
  })

  it('flags text over LinkedIn limits', () => {
    const blocks = linkedInBlocks({ ...resume, contact: { ...resume.contact, headline: 'x'.repeat(221) } })
    expect(blocks[0].tooLong).toBe(true)
  })

  it('joins everything for one copy', () => {
    expect(linkedInText(linkedInBlocks(resume))).toContain('ABOUT\nEngineer who ships payments systems.')
  })
})
