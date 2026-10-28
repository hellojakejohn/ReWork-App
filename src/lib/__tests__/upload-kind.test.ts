import { describe, expect, it } from 'vitest'
import { Document, Packer, Paragraph } from 'docx'
import { detectResumeKind } from '@/lib/upload-kind'

describe('detectResumeKind', () => {
  it('reads PDFs by their header, even after leading junk', () => {
    expect(detectResumeKind(Buffer.from('%PDF-1.7\n...'))).toBe('pdf')
    expect(detectResumeKind(Buffer.concat([Buffer.alloc(200, 0x20), Buffer.from('%PDF-1.4')]))).toBe('pdf')
  })

  it('reads a real .docx, and rejects other zips', async () => {
    const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Jane Doe')] }] }))
    expect(detectResumeKind(Buffer.from(docx))).toBe('docx')
    expect(detectResumeKind(Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Buffer.from('xl/workbook.xml')]))).toBeNull()
  })

  it('rejects anything renamed to .pdf or .docx', () => {
    expect(detectResumeKind(Buffer.from('<html><script>alert(1)</script>'))).toBeNull()
    expect(detectResumeKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBeNull() // JPEG
    expect(detectResumeKind(Buffer.alloc(0))).toBeNull()
  })
})
