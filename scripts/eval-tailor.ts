// Eval for the tailor pipeline: npm run eval:tailor
//
// For each fixture in scripts/fixtures/ it runs the real tailor call, the fact guard,
// and keyword coverage, then prints warnings, coverage before/after, and the summary +
// first role's bullets side by side. Needs OPENAI_API_KEY (and optionally
// OPENAI_TAILOR_MODEL); skips cleanly without it. Makes real, billed API calls.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { it } from 'vitest'
import { buildTailorInput, callTailorModel, tailorModel, type MasterResume, type TailorJob } from '@/lib/tailor'
import { factGuard } from '@/lib/fact-guard'
import { coverageReport } from '@/lib/keyword-coverage'

interface Fixture {
  name: string
  job: TailorJob
  resume: MasterResume
}

const FIXTURE_DIR = path.join(__dirname, 'fixtures')
const COL = 70

function wrap(text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > width) {
      if (line) lines.push(line)
      line = word
    } else {
      line = (line + ' ' + word).trim()
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function sideBySide(left: string[], right: string[]): string {
  const l = left.flatMap((t) => [...wrap(t, COL - 2), ''])
  const r = right.flatMap((t) => [...wrap(t, COL - 2), ''])
  const rows = Math.max(l.length, r.length)
  const out = [`${'MASTER'.padEnd(COL)} | TAILORED`, `${'-'.repeat(COL)}-+-${'-'.repeat(COL)}`]
  for (let i = 0; i < rows; i++) out.push(`${(l[i] ?? '').padEnd(COL)} | ${r[i] ?? ''}`)
  return out.join('\n')
}

const fixtures: Fixture[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(FIXTURE_DIR, f), 'utf8')))

if (!process.env.OPENAI_API_KEY) {
  it('eval:tailor', () => {
    console.log('OPENAI_API_KEY is not set; skipping tailor eval. Set it (and optionally OPENAI_TAILOR_MODEL) to run.')
  })
} else {
  for (const fixture of fixtures) {
    it(fixture.name, async () => {
      const input = buildTailorInput(fixture.resume)
      const started = Date.now()
      const { output, model } = await callTailorModel(input, fixture.job)
      const { cleaned, warnings } = factGuard(input, output)
      const coverage = coverageReport(input, cleaned)

      const firstMaster = input.roles[0]
      const firstTailored = cleaned.roles[0]
      const report = [
        '',
        '='.repeat(COL * 2 + 3),
        `${fixture.name}  (${model}, ${((Date.now() - started) / 1000).toFixed(1)}s)`,
        `Target: ${fixture.job.title} at ${fixture.job.company}`,
        `Fact-guard warnings: ${warnings.length}`,
        ...warnings.map((w) => `  - [${w.type}] ${w.message}`),
        `Keyword coverage: ${coverage.master.score}% -> ${coverage.tailored.score}%`,
        `Target keywords: ${cleaned.targetKeywords.join(', ')}`,
        `Still missing: ${coverage.tailored.missing.join(', ') || '(none)'}`,
        '',
        'SUMMARY',
        sideBySide([input.summary], [cleaned.summary]),
        '',
        `FIRST ROLE: ${firstMaster?.title} at ${firstMaster?.company}`,
        sideBySide(
          (firstMaster?.bullets ?? []).map((b) => `• ${b}`),
          (firstTailored?.bullets ?? []).map((b) => `• ${b.text}\n  (${b.reason})`)
        ),
      ]
      console.log(report.join('\n'))
    })
  }
}

console.log(`Tailor eval: ${fixtures.length} fixtures, model ${tailorModel()}`)
