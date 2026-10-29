// The /api/health file check runs the real PDF and DOCX extractors (no mocks).
import { describe, expect, it } from 'vitest'
import { checkFileReading } from '@/lib/health-files'

describe('checkFileReading', () => {
  it('reads the built-in PDF and a generated DOCX', async () => {
    const { pdf, docx } = await checkFileReading()
    expect(pdf).toMatchObject({ ok: true })
    expect(docx).toMatchObject({ ok: true })
  })
})
