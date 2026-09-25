// Word export smoke test: a real .docx that Word-reading code (mammoth, same as our
// parser) can open, with standard headings, real list bullets and no layout tables.
import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { coverLetterDocxBuffer, letterBlocks, resumeDocxBuffer } from '@/lib/resume-docx'
import { extractDocxText } from '@/lib/resume-source-text'
import type { ParsedResume } from '@/types/parsed-resume'

const resume: ParsedResume = {
  contact: { fullName: 'Jakob Johnson', headline: 'Software Engineer', email: 'j@x.io', phone: '(651) 555-0142', location: 'Saint Paul, MN', links: [{ label: 'GitHub', url: 'https://github.com/hellojakejohn' }] },
  summary: 'Full-stack engineer.',
  skills: [{ group: 'Languages', items: ['TypeScript', 'Solidity'] }],
  experience: [{ id: 'e1', title: 'Founder', company: 'ReWork', location: 'Remote', startDate: '06/2024', endDate: '', current: true, bullets: ['Built the app', 'Integrated Stripe billing'] }],
  projects: [{ id: 'p1', name: 'Vault', url: 'github.com/x/vault', dates: '2025', bullets: ['Wrote contracts'], tech: ['Foundry'] }],
  education: [{ id: 'd1', school: 'Metana', credential: 'Solidity Bootcamp', field: '', startDate: '', endDate: '2025', details: [] }],
  certifications: [],
  extraSections: [],
}

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  return zip.file('word/document.xml')!.async('string')
}

describe('resume .docx', () => {
  it('is a valid Word file with the Classic structure', async () => {
    const buffer = await resumeDocxBuffer(resume)
    expect(buffer.subarray(0, 2).toString()).toBe('PK') // zip container

    const text = await extractDocxText(buffer)
    for (const expected of ['Jakob Johnson', 'Software Engineer', 'Summary', 'Experience', 'Projects', 'Skills', 'Education', 'Founder, ReWork', 'Built the app', 'Languages: TypeScript, Solidity', '06/2024 – Present']) {
      expect(text).toContain(expected)
    }
    // Standard section order
    const order = ['Summary', 'Experience', 'Projects', 'Skills', 'Education'].map((h) => text.indexOf(h))
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('uses heading styles and real list bullets, no tables, text boxes or images', async () => {
    const xml = await documentXml(await resumeDocxBuffer(resume))
    expect(xml).toContain('w:val="Heading1"')
    expect((xml.match(/<w:numPr>/g) ?? []).length).toBe(3) // 2 role bullets + 1 project bullet
    expect(xml).not.toContain('<w:tbl>')
    expect(xml).not.toContain('<w:txbxContent')
    expect(xml).not.toContain('<w:drawing')
    expect(xml).not.toContain('•') // bullets come from numbering, not typed characters
  })
})

describe('cover letter .docx', () => {
  it('keeps the resume header and the letter paragraphs', async () => {
    const letter = 'Dear Hiring Team,\n\nFirst paragraph.\n\nSecond paragraph.\n\nSincerely,\nJakob Johnson'
    const buffer = await coverLetterDocxBuffer(resume, letter)
    const text = await extractDocxText(buffer)
    for (const expected of ['Jakob Johnson', 'j@x.io', 'Dear Hiring Team,', 'First paragraph.', 'Second paragraph.', 'Sincerely,']) {
      expect(text).toContain(expected)
    }
    expect(await documentXml(buffer)).not.toContain('<w:tbl>')
  })

  it('splits paragraphs on blank lines only', () => {
    expect(letterBlocks('A\n\nB line 1\nB line 2\n\n\n  C  ')).toEqual(['A', 'B line 1\nB line 2', 'C'])
  })
})
