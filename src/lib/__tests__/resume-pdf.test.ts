import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { ResumePdf } from '@/lib/resume-pdf'
import { extractPdfText } from '@/lib/resume-source-text'
import type { ParsedResume } from '@/types/parsed-resume'

const resume: ParsedResume = {
  contact: { fullName: 'Jakob Johnson', headline: 'Software Engineer', email: 'j@x.io', phone: '(651) 555-0142', location: 'Saint Paul, MN', links: [{ label: 'GitHub', url: 'https://github.com/hellojakejohn' }] },
  summary: 'Full-stack engineer.',
  skills: [{ group: 'Languages', items: ['TypeScript', 'Solidity'] }],
  experience: [{ id: 'e1', title: 'Founder', company: 'ReWork', location: 'Remote', startDate: '06/2024', endDate: '', current: true, bullets: ['Built the app', ''] }],
  projects: [{ id: 'p1', name: 'Vault', url: 'github.com/x/vault', dates: '2025', bullets: ['Wrote contracts'], tech: ['Foundry'] }],
  education: [{ id: 'd1', school: 'Metana', credential: 'Solidity Bootcamp', field: '', startDate: '', endDate: '2025', details: [] }],
  certifications: [{ name: 'AWS Cloud Practitioner', issuer: '', date: '' }],
  extraSections: [{ heading: 'Languages', items: ['Spanish'] }],
}

describe('ResumePdf', () => {
  it.each(['classic', 'modern'] as const)('%s renders readable text with standard headings', async (template) => {
    const buffer = Buffer.from(await renderToBuffer(React.createElement(ResumePdf, { resume, template }) as never))
    const text = await extractPdfText(buffer)
    for (const expected of ['Jakob Johnson', 'Software Engineer', 'EXPERIENCE', 'Founder, ReWork', '06/2024 – Present', 'Built the app', 'PROJECTS', 'EDUCATION', 'SKILLS', 'Languages: TypeScript, Solidity', 'CERTIFICATIONS', 'github.com/hellojakejohn']) {
      expect(text).toContain(expected)
    }
  }, 20_000)
})
