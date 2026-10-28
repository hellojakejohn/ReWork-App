// Launch audit: parseResume and the validator on hostile or unusual inputs. Real pdfjs and
// mammoth, fake OpenAI-shaped client (no network). it.fails = proven bug; comment says
// what correct behavior is.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Document, Link, Page, View, renderToBuffer } from '@react-pdf/renderer'
import { PARSE_FAILED_MESSAGE, parseResume, ResumeParseError } from '@/lib/parse-resume'
import { validateParsedResume } from '@/lib/parse-validate'
import { cleanSourceText } from '@/lib/resume-source-text'
import type { ParsedResume } from '@/types/parsed-resume'

function buildPdf(objects: string[], extraTrailer = ''): Buffer {
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'))
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${extraTrailer} >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

const PAGE_OBJS = (stream: string) => [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
]

const hex32 = 'a'.repeat(64)
// Standard security handler R2 with an O/U pair that does NOT match the empty password,
// i.e. a user-password-protected PDF.
const encryptedPdf = () =>
  buildPdf([...PAGE_OBJS('BT /F1 12 Tf 72 720 Td (secret) Tj ET'), `<< /Filter /Standard /V 1 /R 2 /O <${hex32}> /U <${hex32}> /P -4 >>`], `/Encrypt 6 0 R /ID [<0123456789abcdef0123456789abcdef> <0123456789abcdef0123456789abcdef>]`)

function fakeClient(impl: () => unknown) {
  const create = vi.fn(async () => impl())
  return { client: { chat: { completions: { create } } } as never, create }
}
const reply = (content: string) => ({ model: 'gpt-test', choices: [{ finish_reason: 'stop', message: { content } }] })

function emptyParse(): ParsedResume {
  return {
    contact: { fullName: '', headline: '', email: '', phone: '', location: '', links: [] },
    summary: '',
    skills: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    extraSections: [],
  }
}

const RESUME_TEXT = `Jane Doe
jane@example.com | (651) 555-0142
EXPERIENCE
Senior Engineer, Acme Corp, 2019 - 2024
Built the billing system used by 2,000 customers and cut invoice errors by 40%.
EDUCATION
University of Minnesota, B.S. Computer Science`

describe('parseResume failure paths always carry a human userMessage', () => {
  it('password-protected PDF: an unreadable_file error that names the password', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = await parseResume({ kind: 'pdf', buffer: encryptedPdf(), filename: 'r.pdf' }).catch((e) => e)
    spy.mockRestore()
    expect(error).toBeInstanceOf(ResumeParseError)
    expect(error.kind).toBe('unreadable_file')
    expect(error.userMessage).not.toBe(PARSE_FAILED_MESSAGE)
    expect(error.message).toMatch(/password/i)
  }, 20_000)

  // Correct behavior: a password-protected PDF gets its own message, e.g. "That PDF is
  // password-protected. Save a copy without a password, or paste your resume text."
  it('password-protected PDF gets a password-specific message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = await parseResume({ kind: 'pdf', buffer: encryptedPdf(), filename: 'r.pdf' }).catch((e) => e)
    spy.mockRestore()
    expect(error.userMessage).toMatch(/password/i)
  }, 20_000)

  it('corrupted PDF (header then garbage) fails with a human message, never the pdfjs error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(4000, 0x41)])
    const error = await parseResume({ kind: 'pdf', buffer: bad, filename: 'r.pdf' }).catch((e) => e)
    spy.mockRestore()
    expect(error).toBeInstanceOf(ResumeParseError)
    expect([PARSE_FAILED_MESSAGE, "We couldn't find any text in that file (it may be a scan or an image). Paste your resume text instead."]).toContain(error.userMessage)
  }, 20_000)

  it('image-only / scanned PDF (no text layer) stops before the model with the "scan" message', async () => {
    const { client, create } = fakeClient(() => reply('{}'))
    const pdf = buildPdf(PAGE_OBJS('0 0 1 rg 72 72 200 200 re f'))
    const error = await parseResume({ kind: 'pdf', buffer: pdf, filename: 'scan.pdf' }, { client }).catch((e) => e)
    expect(error.kind).toBe('too_short')
    expect(error.userMessage).toMatch(/scan or an image/)
    expect(create).not.toHaveBeenCalled()
  }, 20_000)

  // Correct behavior: "Links in file:" URLs harvested from link annotations should not count
  // toward MIN_SOURCE_CHARS. Today a scanned PDF with a few links passes the 80-char floor,
  // goes to the model as a PDF (which can read the scan as an image), and the validator,
  // whose source text has no resume content, drops name/companies/schools while titles and
  // bullets (never validated) are kept.
  it('scanned PDF with only link annotations still gets the "scan" message, not a model call', async () => {
    const h = React.createElement
    const doc = h(
      Document,
      null,
      h(
        Page,
        { size: 'LETTER' },
        h(
          View,
          null,
          h(Link, { src: 'https://www.linkedin.com/in/jane-doe-1234567' }, ' '),
          h(Link, { src: 'https://github.com/janedoe-engineering' }, ' '),
          h(Link, { src: 'https://janedoe-portfolio.example.com/work' }, ' ')
        )
      )
    )
    const pdf = Buffer.from(await renderToBuffer(doc as never))
    const { client, create } = fakeClient(() => reply(JSON.stringify(emptyParse())))
    await parseResume({ kind: 'pdf', buffer: pdf, filename: 'scan.pdf' }, { client }).catch(() => null)
    expect(create).not.toHaveBeenCalled()
  }, 20_000)

  it('model returns nothing: generic retry message, no stack trace', async () => {
    const { client } = fakeClient(() => reply(''))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = await parseResume({ kind: 'text', text: RESUME_TEXT }, { client }).catch((e) => e)
    spy.mockRestore()
    expect(error).toBeInstanceOf(ResumeParseError)
    expect(error.userMessage).toBe(PARSE_FAILED_MESSAGE)
  })

  it('model returns an all-empty resume: "empty" error, nothing saved', async () => {
    const { client } = fakeClient(() => reply(JSON.stringify(emptyParse())))
    const error = await parseResume({ kind: 'text', text: RESUME_TEXT }, { client }).catch((e) => e)
    expect(error.kind).toBe('empty')
    expect(error.userMessage).toBe(PARSE_FAILED_MESSAGE)
  })

  it('pasted text over 30k chars (after cleaning) is refused before the model', async () => {
    const { client, create } = fakeClient(() => reply('{}'))
    const error = await parseResume({ kind: 'text', text: RESUME_TEXT + '\n' + 'word '.repeat(6100) }, { client }).catch((e) => e)
    expect(error.status).toBe(413)
    expect(error.userMessage).toBe('That resume is too long for us to read. Try a shorter version.')
    expect(create).not.toHaveBeenCalled()
  })

  it('a long (about 6-page, 25k chars) resume is accepted and sent whole, with an 8000-token answer budget', async () => {
    const long = RESUME_TEXT + '\n' + Array.from({ length: 250 }, (_, i) => `Shipped project number ${i} for the billing team at Acme Corp.`).join('\n')
    expect(long.length).toBeGreaterThan(15_000)
    expect(long.length).toBeLessThan(30_000)
    const { client, create } = fakeClient(() => reply(''))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await parseResume({ kind: 'text', text: long }, { client }).catch(() => null)
    spy.mockRestore()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (create.mock.calls[0] as unknown as [Record<string, any>])[0]
    expect(body.messages[1].content).toContain('Shipped project number 249')
  })
})

describe('validator on non-English resumes', () => {
  const base = (company: string, school: string, fullName: string): ParsedResume => ({
    ...emptyParse(),
    contact: { ...emptyParse().contact, fullName },
    experience: [{ id: 'exp_1', title: 'X', company, location: '', startDate: '', endDate: '', current: false, bullets: [] }],
    education: [{ id: 'edu_1', school, credential: '', field: '', startDate: '', endDate: '', details: [] }],
  })

  it.each([
    ['German', 'Jürgen Groß', 'Müller & Söhne GmbH', 'Technische Universität München'],
    ['Spanish', 'José Peña', 'Telefónica España', 'Universidad de Córdoba'],
    ['Russian', 'Иван Петров', 'ООО Яндекс', 'МГУ им. Ломоносова'],
    ['Japanese', '山田 太郎', '株式会社ソニー', '東京大学'],
    ['Arabic', 'محمد علي', 'شركة أرامكو', 'جامعة القاهرة'],
  ])('%s names, companies and schools copied exactly are kept', (_lang, name, company, school) => {
    const src = cleanSourceText(`${name}\nErfahrung\n${company}\n${school}`)
    const { resume, needsReview } = validateParsedResume(base(company, school, name), src)
    expect(needsReview).toEqual([])
    expect(resume.experience[0].company).toBe(company)
    expect(resume.education[0].school).toBe(school)
    expect(resume.contact.fullName).toBe(name)
  })

  // Correct behavior: Unicode normalization should not matter. Text from macOS-authored
  // DOCX/pastes is often NFD ("e" + U+0301); models answer in NFC ("é"). compact() strips
  // \p{M} combining marks from the NFD side only, so the company is dropped and flagged
  // "This company isn't in your file." Fix: .normalize('NFC') (or NFKC) both sides.
  it('NFD source text vs NFC model output still matches', () => {
    const src = cleanSourceText('José Peña\nTelefónica España\nUniversidad de Córdoba'.normalize('NFD'))
    const { needsReview } = validateParsedResume(base('Telefónica España', 'Universidad de Córdoba', 'José Peña'), src)
    expect(needsReview).toEqual([])
  })

  it('non-ASCII phone digits are not recognized (Low: Arabic-Indic numerals)', () => {
    const src = 'محمد علي\nهاتف: ٠١٢٣٤٥٦٧٨٩'
    const parsed = { ...emptyParse(), contact: { ...emptyParse().contact, phone: '٠١٢٣٤٥٦٧٨٩' } }
    expect(validateParsedResume(parsed, src).resume.contact.phone).toBe('')
  })

  it('internationalized email (non-ASCII local part) is dropped as "not a valid email" (Low)', () => {
    const src = 'Jürgen\njürgen@beispiel.de'
    const parsed = { ...emptyParse(), contact: { ...emptyParse().contact, email: 'jürgen@beispiel.de' } }
    const { needsReview } = validateParsedResume(parsed, src)
    expect(needsReview[0]?.reason).toBe("This isn't a valid email.")
  })
})
