// Launch audit: what upload-kind detection and the input caps do on crafted bytes.
// Tests marked it.fails prove a bug; the comment says what correct behavior is.
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { detectResumeKind } from '@/lib/upload-kind'
import { extractPdfText } from '@/lib/resume-source-text'
import { INPUT_LIMITS } from '@/lib/plans'
import { clip, clipList, httpUrlOrNull } from '@/lib/input'

/** A tiny valid PDF with correct xref offsets. `extraTrailer` goes into the trailer dict. */
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

function textPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ])
}

async function docxBuffer(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('word/document.xml', '<w:document/>')
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

describe('detectResumeKind on crafted bytes', () => {
  it('a real (tiny) PDF is pdf', () => {
    expect(detectResumeKind(textPdf('Hello'))).toBe('pdf')
  })

  it('a 0-byte file is rejected (route answers NOT_A_RESUME_FILE, 400)', () => {
    expect(detectResumeKind(Buffer.alloc(0))).toBeNull()
  })

  it('a PNG renamed .pdf is rejected', () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200)])
    expect(detectResumeKind(png)).toBeNull()
  })

  it('a legacy .doc (OLE2 compound file) is rejected', () => {
    const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(512)])
    expect(detectResumeKind(ole)).toBeNull()
  })

  it('a DOCX (deflated zip) is docx; file names stay readable in the zip headers', async () => {
    expect(detectResumeKind(await docxBuffer())).toBe('docx')
  })

  it('an .xlsx / plain zip is rejected', async () => {
    const zip = new JSZip()
    zip.file('xl/workbook.xml', '<x/>')
    expect(detectResumeKind(await zip.generateAsync({ type: 'nodebuffer' }))).toBeNull()
  })

  it('a PDF renamed .txt is still a pdf by bytes (but the client dropzone rejects .txt before upload)', () => {
    expect(detectResumeKind(textPdf('Hello'))).toBe('pdf')
  })

  it('an encrypted PDF header (/Encrypt in trailer) is still detected as pdf', () => {
    const enc = buildPdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [] /Count 0 >>'], '/Encrypt << /Filter /Standard /V 1 /R 2 /O <00> /U <00> /P -4 >>')
    expect(detectResumeKind(enc)).toBe('pdf')
  })

  // Correct behavior: detection and extraction agree. detectResumeKind accepts "%PDF-"
  // anywhere in the first 1024 bytes (spec allows leading junk), but extractPdfText
  // requires it at byte 0, so such a file is accepted and then fails with the generic
  // "We couldn't read that file, try again" message.
  it.fails('a PDF with leading junk bytes is both detected AND extractable', async () => {
    const pdf = Buffer.concat([Buffer.from('JUNKHEADER\n'), textPdf('Hello world')])
    expect(detectResumeKind(pdf)).toBe('pdf')
    await expect(extractPdfText(pdf)).resolves.toContain('Hello world')
  })
})

describe('input caps', () => {
  it('caps match STATE.md (4 MB file, 30k pasted chars, 20k job description)', () => {
    expect(INPUT_LIMITS.resumeFileBytes).toBe(4 * 1024 * 1024)
    expect(INPUT_LIMITS.resumeTextChars).toBe(30_000)
    expect(INPUT_LIMITS.jobDescriptionChars).toBe(20_000)
    // Headroom under Vercel's 4.5 MB body limit for multipart overhead.
    expect(4.5 * 1024 * 1024 - INPUT_LIMITS.resumeFileBytes).toBeGreaterThan(400_000)
  })

  it('clip trims and cuts; non-strings become empty', () => {
    expect(clip('  abc  ', 2)).toBe('ab')
    expect(clip(123, 10)).toBe('')
    expect(clip({ toString: () => 'x' }, 10)).toBe('')
  })

  it('clipList drops empties and caps count', () => {
    expect(clipList(['a', '', 'b', 'c'], 2, 10)).toEqual(['a', 'b'])
    expect(clipList('nope', 2, 10)).toEqual([])
  })

  it('httpUrlOrNull refuses javascript: and data: URLs', () => {
    expect(httpUrlOrNull('javascript:alert(1)')).toBeNull()
    expect(httpUrlOrNull('data:text/html,x')).toBeNull()
    expect(httpUrlOrNull(' https://x.io/a ')).toBe('https://x.io/a')
  })
})
