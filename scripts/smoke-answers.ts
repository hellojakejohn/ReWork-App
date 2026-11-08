// Real-model smoke test for application answers and interview prep (BILLED: a few cents a
// call; ask Jake for a budget first). Uses the public resume fixtures as both the master and
// the tailored version, so no tailor call is spent. No database writes.
// Run: npm run smoke:answers
// Output: eval-results/smoke-answers-<time>.json (gitignored) and a summary on stdout.
import { loadEnvConfig } from '@next/env'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTailorInput, type MasterResume } from '@/lib/tailor'
import { masterToParsed } from '@/lib/master-resume'
import { recruiterText } from '@/lib/recruiter-text'
import { allowedSourceText } from '@/lib/cover-letter'
import { generateAnswer, type AnswerLength } from '@/lib/app-answers'
import { generateInterviewPrep } from '@/lib/interview-prep'
import { collectUsage } from '@/lib/ai-usage'
import { unsupportedFacts, hasUnsupported } from '@/lib/text-facts'

loadEnvConfig(process.cwd())

const HERE = path.dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => JSON.parse(readFileSync(path.join(HERE, 'fixtures', name), 'utf8')) as { job: { title: string; company: string; description: string }; resume: MasterResume }

function setup(name: string) {
  const f = fixture(name)
  const master = f.resume
  const tailored = masterToParsed(master as unknown as Record<string, unknown>)
  const input = { master: buildTailorInput(master), tailoredText: recruiterText(master), candidateName: tailored.contact.fullName, job: f.job }
  return { name, f, tailored, input, allowedText: allowedSourceText(input) }
}

const ANSWERS: { fixture: string; question: string; length: AnswerLength }[] = [
  { fixture: 'junior-frontend-to-senior-react.json', question: 'Why do you want to work at Lumen Health?', length: 'medium' },
  { fixture: 'restaurant-manager-to-ops-coordinator.json', question: 'What are your salary expectations, and when could you start?', length: 'short' },
  { fixture: 'solidity-dev-to-backend-node.json', question: 'Tell us about a project you are proud of.', length: 'long' },
]
const PREPS = ['junior-frontend-to-senior-react.json', 'restaurant-manager-to-ops-coordinator.json']

async function main() {
  const out: Record<string, unknown>[] = []
  let total = 0
  for (const a of ANSWERS) {
    const s = setup(a.fixture)
    const { run, usage } = collectUsage(() => generateAnswer({ ...s.input, question: a.question, length: a.length }))
    const start = Date.now()
    try {
      const r = await run
      const leak = unsupportedFacts(r.answer, s.allowedText, s.f.job.description)
      const words = r.answer.split(/\s+/).length
      console.log(`\n=== ANSWER ${a.fixture} (${a.length}) ${words} words, ${Date.now() - start} ms, $${usage().costUsd}`)
      console.log(`Q: ${a.question}\n${r.answer}\nneedsYou: ${r.needsYou}\nwarnings: ${r.warnings.map((w) => w.message).join(' | ') || 'none'}`)
      console.log(`post-guard leak check: ${hasUnsupported(leak) ? JSON.stringify(leak) : 'clean'}  em-dash: ${/—/.test(r.answer)}`)
      out.push({ kind: 'answer', ...a, result: r, usage: usage() })
    } catch (e) {
      console.log(`\n=== ANSWER ${a.fixture} FAILED: ${(e as Error).message}`)
      out.push({ kind: 'answer', ...a, error: (e as Error).message, usage: usage() })
    }
    total += usage().costUsd
  }
  for (const name of PREPS) {
    const s = setup(name)
    const { run, usage } = collectUsage(() => generateInterviewPrep({ tailored: s.tailored, allowedText: s.allowedText, job: s.f.job }))
    const start = Date.now()
    try {
      const r = await run
      console.log(`\n=== PREP ${name} ${r.questions.length} questions, ${Date.now() - start} ms, $${usage().costUsd}`)
      r.questions.forEach((q, i) => console.log(`${i + 1}. ${q.question}\n   why: ${q.why}\n   proof: ${q.bullets.length ? q.bullets.join(' || ') : '(gap)'}\n   angle: ${q.angle}`))
      console.log(`ask them: ${r.askThem.join(' | ')}`)
      out.push({ kind: 'prep', fixture: name, result: r, usage: usage() })
    } catch (e) {
      console.log(`\n=== PREP ${name} FAILED: ${(e as Error).message}`)
      out.push({ kind: 'prep', fixture: name, error: (e as Error).message, usage: usage() })
    }
    total += usage().costUsd
  }
  const dir = path.join(HERE, '..', 'eval-results')
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `smoke-answers-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(file, JSON.stringify(out, null, 2))
  console.log(`\nTOTAL $${total.toFixed(4)}  -> ${path.relative(process.cwd(), file)}`)
}

void main()
