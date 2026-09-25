// Word (.docx) export for tailored resumes and cover letters. Same structure as the Classic
// template: single column, real text, standard headings as Word heading styles, bullets
// as real list items. No tables, text boxes or images, so application portals (ATS) can
// read every line. Dates sit on a right-aligned tab stop, not in a table cell.
import { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TabStopType, TextRun, type IRunOptions } from 'docx'
import { toLayout } from '@/lib/resume-templates'
import type { ParsedResume } from '@/types/parsed-resume'

const FONT = 'Times New Roman'
const BULLETS = 'resume-bullets'
// US Letter, 0.7in side margins: 12240 - 2 * 1008 twips of text width.
const MARGIN = 1008
const TEXT_WIDTH = 12240 - 2 * MARGIN

function doc(title: string, author: string, children: Paragraph[]): Document {
  return new Document({
    title,
    creator: author || 'ReWork',
    styles: {
      default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { after: 0, line: 264 } } } },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 22, bold: true, allCaps: true, color: '111827' },
          paragraph: {
            spacing: { before: 200, after: 80 },
            border: { bottom: { style: 'single', size: 6, color: '111827', space: 1 } },
          },
        },
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 36, bold: true, color: '111827' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 40 } },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1008, bottom: 1008, left: MARGIN, right: MARGIN } } },
        children,
      },
    ],
  })
}

const run = (text: string, options: Omit<IRunOptions, 'text'> = {}) => new TextRun({ text, ...options })
const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1 })
const bullet = (text: string) => new Paragraph({ children: [run(text)], numbering: { reference: BULLETS, level: 0 } })

/** "Title, Company<TAB>Dates" with the dates right-aligned on a tab stop. */
function entryLine(left: TextRun[], right: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
    spacing: { before: 80 },
    children: right ? [...left, run(`\t${right}`)] : left,
  })
}

function header(name: string, headline: string, contactItems: string[]): Paragraph[] {
  const out: Paragraph[] = []
  if (name) out.push(new Paragraph({ text: name, heading: HeadingLevel.TITLE }))
  if (headline) out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(headline, { color: '374151' })] }))
  if (contactItems.length) {
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run(contactItems.join('  |  '), { size: 18, color: '374151' })] }))
  }
  return out
}

export function resumeDocument(resume: ParsedResume): Document {
  const l = toLayout(resume)
  const children: Paragraph[] = [...header(l.name, l.headline, l.contactItems)]

  if (l.summary) {
    children.push(heading('Summary'), new Paragraph({ children: [run(l.summary)] }))
  }
  if (l.experience.length) {
    children.push(heading('Experience'))
    for (const e of l.experience) {
      children.push(entryLine([run([e.title, e.company].filter(Boolean).join(', '), { bold: true })], e.dates))
      if (e.location) children.push(new Paragraph({ children: [run(e.location, { italics: true, size: 19 })] }))
      children.push(...e.bullets.map(bullet))
    }
  }
  if (l.projects.length) {
    children.push(heading('Projects'))
    for (const p of l.projects) {
      children.push(entryLine([run(p.name, { bold: true }), ...(p.url ? [run(`  ${p.url}`)] : [])], p.dates))
      children.push(...p.bullets.map(bullet))
      if (p.tech) children.push(new Paragraph({ children: [run(p.tech, { italics: true, size: 19 })] }))
    }
  }
  if (l.skills.length) {
    children.push(heading('Skills'))
    for (const g of l.skills) {
      children.push(new Paragraph({ children: [...(g.group ? [run(`${g.group}: `, { bold: true })] : []), run(g.items)] }))
    }
  }
  if (l.education.length) {
    children.push(heading('Education'))
    for (const e of l.education) {
      children.push(entryLine([run(e.school, { bold: true })], e.dates))
      if (e.credential) children.push(new Paragraph({ children: [run(e.credential)] }))
      children.push(...e.details.map(bullet))
    }
  }
  if (l.certifications.length) {
    children.push(heading('Certifications'), ...l.certifications.map(bullet))
  }
  for (const section of l.extraSections) {
    children.push(heading(section.heading), ...section.items.map(bullet))
  }

  return doc(l.name ? `${l.name} Resume` : 'Resume', l.name, children)
}

/**
 * Cover letter with the same header as the resume. `text` is the letter as the user sees
 * it in the editor: paragraphs separated by blank lines, line breaks kept inside a
 * paragraph (so "Sincerely,\nJakob" stays two lines).
 */
export function coverLetterDocument(resume: ParsedResume, text: string, date = new Date()): Document {
  const l = toLayout(resume)
  const children: Paragraph[] = [...header(l.name, l.headline, l.contactItems)]
  children.push(
    new Paragraph({
      spacing: { before: 240, after: 240 },
      children: [run(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))],
    })
  )
  for (const block of letterBlocks(text)) {
    const lines = block.split('\n')
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: lines.map((line, i) => run(line, i > 0 ? { break: 1 } : {})),
      })
    )
  }
  return doc(l.name ? `${l.name} Cover Letter` : 'Cover Letter', l.name, children)
}

/** Paragraphs of a plain-text letter. */
export function letterBlocks(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.replace(/[ \t]+\n/g, '\n').trim())
    .filter(Boolean)
}

export async function resumeDocxBuffer(resume: ParsedResume): Promise<Buffer> {
  return Packer.toBuffer(resumeDocument(resume))
}

export async function coverLetterDocxBuffer(resume: ParsedResume, text: string): Promise<Buffer> {
  return Packer.toBuffer(coverLetterDocument(resume, text))
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
