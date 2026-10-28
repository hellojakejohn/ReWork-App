// What an uploaded resume really is, from its bytes, not its name or MIME type. Pure.
//
// PDF: "%PDF-" within the first 1024 bytes (the spec allows leading junk).
// DOCX: a ZIP ("PK\x03\x04") whose (uncompressed) file names include word/document.xml.

export type ResumeFileKind = 'pdf' | 'docx'

const PDF_MAGIC = Buffer.from('%PDF-')
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const DOCX_PART = Buffer.from('word/document.xml')

export function detectResumeKind(buffer: Buffer): ResumeFileKind | null {
  if (buffer.subarray(0, 1024).includes(PDF_MAGIC)) return 'pdf'
  if (buffer.subarray(0, 4).equals(ZIP_MAGIC) && buffer.includes(DOCX_PART)) return 'docx'
  return null
}
