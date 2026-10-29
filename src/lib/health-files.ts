// /api/health check that resume files can be read on this deployment. The PDF and DOCX
// libraries load files at runtime that the bundler can miss (pdfjs's worker and
// @napi-rs/canvas, Oct 28: every PDF upload failed in prod while tests passed locally),
// so this runs the real extractors on a tiny PDF and a generated DOCX.
import { Document, Packer, Paragraph } from 'docx'
import { extractDocxText, extractPdfText } from '@/lib/resume-source-text'

const MARKER = 'ReWork file check'

// One page, one line of Helvetica. No xref table: pdfjs rebuilds it, as it does for many
// real-world PDFs.
const TINY_PDF = [
  '%PDF-1.4',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 50]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj',
  `4 0 obj<</Length 48>>stream\nBT /F1 12 Tf 10 20 Td (${MARKER}) Tj ET\nendstream endobj`,
  '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
  'trailer<</Root 1 0 R>>',
  '%%EOF',
].join('\n')

export interface FileCheck {
  ok: boolean
  ms: number
  detail?: string
}

async function timed(fn: () => Promise<string>): Promise<FileCheck> {
  const start = Date.now()
  try {
    const text = await fn()
    if (!text.includes(MARKER)) return { ok: false, ms: Date.now() - start, detail: `read, but the text was wrong: ${text.slice(0, 80)}` }
    return { ok: true, ms: Date.now() - start }
  } catch (error) {
    return { ok: false, ms: Date.now() - start, detail: String((error as Error)?.message || error).slice(0, 300) }
  }
}

export async function checkFileReading(): Promise<{ pdf: FileCheck; docx: FileCheck }> {
  const [pdf, docx] = await Promise.all([
    timed(() => extractPdfText(Buffer.from(TINY_PDF, 'latin1'))),
    timed(async () => {
      const doc = new Document({ sections: [{ children: [new Paragraph(MARKER)] }] })
      return extractDocxText(await Packer.toBuffer(doc))
    }),
  ])
  return { pdf, docx }
}
