// Real pdfjs and mammoth runs on generated files (no fixtures on disk needed).
import React from 'react'
import { describe, expect, it } from 'vitest'
import { Document, Link, Page, Text, View, renderToBuffer } from '@react-pdf/renderer'
import JSZip from 'jszip'
import { extractDocxText, extractPdfText } from '@/lib/resume-source-text'

const h = React.createElement

async function samplePdf(): Promise<Buffer> {
  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: 'LETTER', style: { padding: 40, fontSize: 11 } },
      h(Text, { style: { fontSize: 20 } }, 'JAKOB JOHNSON'),
      h(Text, null, 'Software Engineer'),
      h(
        View,
        { style: { flexDirection: 'row' } },
        h(Text, null, '(651) 555-0142'),
        h(Text, { style: { marginLeft: 30 } }, 'jakobmjohnson9@gmail.com'),
        h(Link, { src: 'https://www.linkedin.com/in/jakob-johnson', style: { marginLeft: 30 } }, 'LinkedIn')
      ),
      h(Text, { style: { marginTop: 20 } }, 'EXPERIENCE'),
      h(
        View,
        { style: { flexDirection: 'row' } },
        h(Text, { style: { width: 120 } }, '06/2024 - Present'),
        h(Text, null, 'Founder & Software Engineer')
      )
    )
  )
  return Buffer.from(await renderToBuffer(doc as never))
}

describe('extractPdfText', () => {
  it('reads lines by position, separates fields, and surfaces link annotation URLs', async () => {
    const text = await extractPdfText(await samplePdf())
    const lines = text.split('\n')
    expect(lines[0]).toBe('JAKOB JOHNSON')
    expect(lines[1]).toBe('Software Engineer')
    expect(lines[2]).toBe('(651) 555-0142 | jakobmjohnson9@gmail.com | LinkedIn')
    expect(text).toContain('06/2024 - Present | Founder & Software Engineer')
    expect(text).toContain('Links in file:\nhttps://www.linkedin.com/in/jakob-johnson')
  }, 20_000)

  it('rejects non-PDF bytes', async () => {
    await expect(extractPdfText(Buffer.from('hello'))).rejects.toThrow('Not a PDF')
  })
})

describe('extractDocxText', () => {
  it('reads paragraphs as lines', async () => {
    const zip = new JSZip()
    zip.file(
      '[Content_Types].xml',
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    )
    zip.file(
      '_rels/.rels',
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    )
    const para = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
    zip.file(
      'word/document.xml',
      `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${para('Ana Diaz')}${para('ana@x.io ​| Minneapolis, MN')}${para('EXPERIENCE')}</w:body></w:document>`
    )
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    expect(await extractDocxText(buffer)).toBe('Ana Diaz\n\nana@x.io | Minneapolis, MN\n\nEXPERIENCE')
  })
})
