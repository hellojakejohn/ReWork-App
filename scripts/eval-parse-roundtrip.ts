// Parse round trip: export a parsed resume the way users download it (Classic PDF, Modern
// PDF, Word) and as pasted text, then parse each back with the real model and compare.
// A resume made by ReWork must come back the same. Real, billed calls (about $0.07 a
// parse on Opus); no database.
//
//   npx tsx --tsconfig tsconfig.json scripts/eval-parse-roundtrip.ts <case.json | resume.pdf> [--max-usd 1] [--only pasted]
//
// <case.json> is an eval-results/*/cases/*.json file (uses its `parsed`); a PDF is parsed
// first to get the starting point.
import { readFileSync } from 'node:fs'
import React from 'react'
import { loadEnvConfig } from '@next/env'
import { renderToBuffer } from '@react-pdf/renderer'
import { parseResume, type ParseInput } from '@/lib/parse-resume'
import { ResumePdf } from '@/lib/resume-pdf'
import { resumeDocxBuffer } from '@/lib/resume-docx'
import { extractPdfText } from '@/lib/resume-source-text'
import { collectUsage } from '@/lib/ai-usage'
import type { ParsedResume } from '@/types/parsed-resume'

loadEnvConfig(process.cwd())

const args = process.argv.slice(2)
const source = args.find((a) => !a.startsWith('--'))
const maxUsd = Number(args[args.indexOf('--max-usd') + 1]) || 1
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
if (!source) throw new Error('usage: eval-parse-roundtrip.ts <case.json | resume.pdf> [--max-usd 1]')

let spent = 0
async function parse(input: ParseInput) {
  if (spent >= maxUsd) throw new Error(`budget reached ($${spent.toFixed(2)})`)
  const { run, usage } = collectUsage(() => parseResume(input))
  try {
    return await run
  } finally {
    spent += usage().costUsd
  }
}

function shape(r: ParsedResume) {
  return {
    name: r.contact.fullName,
    email: r.contact.email,
    links: r.contact.links.length,
    roles: r.experience.map((e) => `${e.title} @ ${e.company} (${e.startDate}-${e.endDate || (e.current ? 'now' : '')}) x${e.bullets.length}`),
    projects: r.projects.map((p) => `${p.name} x${p.bullets.length}`),
    education: r.education.map((e) => `${e.credential} @ ${e.school}`),
    skills: r.skills.reduce((n, g) => n + g.items.length, 0),
    extra: r.extraSections.map((s) => `${s.heading} x${s.items.length}`),
  }
}

function diff(a: ReturnType<typeof shape>, b: ReturnType<typeof shape>): string[] {
  const out: string[] = []
  for (const key of Object.keys(a) as (keyof typeof a)[]) {
    const x = JSON.stringify(a[key])
    const y = JSON.stringify(b[key])
    if (x !== y) out.push(`${key}: ${x} -> ${y}`)
  }
  return out
}

async function main() {
  const start: ParsedResume = source!.endsWith('.json')
    ? JSON.parse(readFileSync(source!, 'utf8')).parsed
    : (await parse({ kind: 'pdf', buffer: readFileSync(source!), filename: source! })).resume
  const base = shape(start)
  console.log('start', JSON.stringify(base, null, 1))

  const inputs: [string, () => Promise<ParseInput>][] = [
    ['classic pdf', async () => ({ kind: 'pdf', buffer: await renderToBuffer(React.createElement(ResumePdf, { resume: start, template: 'classic' }) as never), filename: 'classic.pdf' })],
    ['modern pdf', async () => ({ kind: 'pdf', buffer: await renderToBuffer(React.createElement(ResumePdf, { resume: start, template: 'modern' }) as never), filename: 'modern.pdf' })],
    ['word', async () => ({ kind: 'docx', buffer: await resumeDocxBuffer(start), filename: 'resume.docx' })],
    // What someone gets selecting all in their PDF and pasting.
    ['pasted text', async () => ({ kind: 'text', text: await extractPdfText(await renderToBuffer(React.createElement(ResumePdf, { resume: start, template: 'classic' }) as never)) })],
  ]
  for (const [label, make] of inputs) {
    if (only && !label.includes(only)) continue
    try {
      const t = Date.now()
      const result = await parse(await make())
      const changes = diff(base, shape(result.resume))
      console.log(`\n${label}: ${((Date.now() - t) / 1000).toFixed(1)}s, needsReview ${result.needsReview.length}${changes.length ? '' : ', identical shape'}`)
      for (const c of changes) console.log('  ', c)
      for (const n of result.needsReview) console.log('   review:', n.field, JSON.stringify(n.value).slice(0, 80), '-', n.reason)
    } catch (error) {
      console.log(`\n${label}: FAILED ${(error as Error).message}`)
    }
  }
  console.log(`\nspent about $${spent.toFixed(2)}`)
}

void main()
