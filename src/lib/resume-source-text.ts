// Turning a resume file into clean text for the parser and the validator. Pure functions
// except extractPdfText/extractDocxText, which load pdfjs/mammoth lazily.
//
// Design resumes (Enhancv, Canva, Novoresume) put icon-font glyphs (private-use code
// points) and zero-width spaces between contact fields. Stripped naively, "phone email
// linkedin" collapses into one token, which is how the old parser ended up with
// phone+email+linkedin in the email field. We strip those characters AND keep a
// separator wherever text items sit apart on the page.

// Zero-width and invisible formatting characters, plus soft hyphen and BOM.
const INVISIBLE_RE = /[­᠎​-‏‪-‮⁠-⁤⁦-⁯﻿]/g
// Private-use areas (icon fonts): BMP PUA and the supplementary PUA planes.
const PRIVATE_USE_RE = /[-]|[\uDB80-\uDBFF][\uDC00-\uDFFF]/g
// Control characters except tab/newline. Postgres rejects \u0000.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** Strip invisible, icon and control characters. Keeps line breaks. */
export function stripJunkChars(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE_RE, '')
    .replace(PRIVATE_USE_RE, ' ')
    .replace(CONTROL_RE, '')
    .replace(/[  -   　]/g, ' ')
}

/** Clean free text (pasted resumes, DOCX output): junk chars out, spaces collapsed per line. */
export function cleanSourceText(text: string): string {
  return stripJunkChars(text)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---------- pdfjs text items -> lines by position ----------

export interface PositionedItem {
  str: string
  x: number
  y: number // baseline, PDF units (origin bottom-left)
  width: number
  height: number
}

// Gap (in PDF units, ~1/72 inch) above which two items on the same line are clearly
// separate fields (date column vs role, or contact fields). Smaller gaps are word spaces.
const FIELD_GAP = 12

/**
 * Rebuild lines from positioned text items: group by baseline, sort left to right, and
 * join with a space (word gap) or " | " (field gap). An item that was only an icon glyph
 * or zero-width space also acts as a field separator. Items that touch are concatenated,
 * because pdfjs often splits a single word into several items.
 */
export function itemsToLines(items: PositionedItem[]): string[] {
  const cleaned = items.map((item) => ({ ...item, raw: item.str, str: stripJunkChars(item.str) }))
  const sorted = [...cleaned].sort((a, b) => b.y - a.y || a.x - b.x)

  const rows: (typeof cleaned)[] = []
  for (const item of sorted) {
    const tolerance = Math.max(2, (item.height || 10) * 0.4)
    const row = rows.find((r) => Math.abs(r[0].y - item.y) <= tolerance)
    if (row) row.push(item)
    else rows.push([item])
  }

  const lines: string[] = []
  for (const row of rows.sort((a, b) => b[0].y - a[0].y)) {
    row.sort((a, b) => a.x - b.x)
    let line = ''
    let lastEnd: number | null = null
    let pendingSeparator = false
    for (const item of row) {
      const text = item.str.replace(/\s+/g, ' ')
      if (!text.trim()) {
        // An icon glyph or zero-width space between fields is a separator; a plain space
        // item (pdfjs emits those between words) is just a space.
        // Neither moves lastEnd, so the real gap to the next word still counts.
        if (item.raw.trim().length > 0 && line) pendingSeparator = true
        else if (line && !line.endsWith(' ')) line += ' '
        continue
      }
      if (line) {
        const gap = lastEnd === null ? 0 : item.x - lastEnd
        if (pendingSeparator || gap > FIELD_GAP) {
          line = line.trimEnd() + ' | ' + text.trimStart()
        } else if (gap > 0.8 || /\s$/.test(line) || /^\s/.test(text)) {
          line = line.trimEnd() + ' ' + text.trimStart()
        } else {
          line += text
        }
      } else {
        line = text
      }
      pendingSeparator = false
      lastEnd = item.x + item.width
    }
    const tidy = line
      .replace(/\s+/g, ' ')
      .replace(/(\s*\|\s*)+/g, ' | ')
      .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
      .trim()
    if (tidy) lines.push(tidy)
  }
  return lines
}

// ---------- file extraction (server only) ----------

export class UnreadableFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnreadableFileError'
  }
}

// Just the pdfjs surface we use. src/types/pdfjs.d.ts shadows the package's own types
// with an older, narrower declaration, so we describe what we need here.
interface PdfjsTextItem {
  str?: string
  transform: number[]
  width: number
  height: number
}
interface PdfjsPage {
  getTextContent(): Promise<{ items: PdfjsTextItem[] }>
  getAnnotations(): Promise<{ subtype?: string; url?: unknown }[]>
}
interface PdfjsModule {
  getDocument(params: Record<string, unknown>): {
    promise: Promise<{ numPages: number; getPage(n: number): Promise<PdfjsPage>; destroy(): Promise<void> }>
  }
}

/** Positional text from a PDF via pdfjs. Pages separated by a blank line. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new UnreadableFileError('Not a PDF file')
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfjsModule
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise
  try {
    const pages: string[] = []
    // Design resumes often show "LinkedIn" as text with the real URL only in a link
    // annotation. Collect those so the parser (and the validator) can see them.
    const linkUrls = new Set<string>()
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      for (const annotation of await page.getAnnotations()) {
        if (annotation?.subtype === 'Link' && typeof annotation.url === 'string') linkUrls.add(annotation.url.trim())
      }
      const content = await page.getTextContent()
      const items: PositionedItem[] = []
      for (const item of content.items) {
        if (typeof item.str !== 'string' || !item.transform) continue
        items.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height || Math.abs(item.transform[3]) || 10,
        })
      }
      pages.push(itemsToLines(items).join('\n'))
    }
    const text = pages.join('\n\n').trim()
    const links = [...linkUrls].filter(Boolean)
    return links.length ? `${text}\n\nLinks in file:\n${links.join('\n')}` : text
  } finally {
    await doc.destroy()
  }
}

/** Raw text from a DOCX via mammoth (paragraphs become lines). */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const { value } = await mammoth.extractRawText({ buffer })
  return cleanSourceText(value)
}
