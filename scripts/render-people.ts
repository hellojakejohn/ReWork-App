// Renders every test person (scripts/fixtures/people) as Classic PDF, Modern PDF and Word,
// plus a cover letter PDF, so the templates can be looked at across many kinds of resumes.
// Free: no model calls. Run: npx tsx --tsconfig tsconfig.json scripts/render-people.ts
// Output: eval-results/render/<person>-{classic,modern}.pdf, .docx (gitignored).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { masterToParsed } from '@/lib/master-resume'
import { CoverLetterPdf, ResumePdf } from '@/lib/resume-pdf'
import { resumeDocxBuffer } from '@/lib/resume-docx'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(HERE, 'fixtures', 'people')
const OUT = path.join(HERE, '..', 'eval-results', 'render')

const LETTER = `Dear Hiring Manager,

I'm applying for this role because it builds on the work I do every day. In my current job I lead a team, keep the work organized, and take care of the people we serve.

I'd welcome the chance to talk about how my experience fits your team.

Sincerely,`

async function main() {
  mkdirSync(OUT, { recursive: true })
  for (const f of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
    const name = f.replace(/\.json$/, '')
    const resume = masterToParsed(JSON.parse(readFileSync(path.join(DIR, f), 'utf8')).resume)
    for (const template of ['classic', 'modern'] as const) {
      const pdf = await renderToBuffer(React.createElement(ResumePdf, { resume, template }) as never)
      writeFileSync(path.join(OUT, `${name}-${template}.pdf`), pdf)
    }
    const letter = await renderToBuffer(React.createElement(CoverLetterPdf, { resume, template: 'classic', text: LETTER, date: new Date('2026-11-14') }) as never)
    writeFileSync(path.join(OUT, `${name}-letter.pdf`), letter)
    writeFileSync(path.join(OUT, `${name}.docx`), await resumeDocxBuffer(resume))
    console.log(`rendered ${name}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
