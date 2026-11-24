// Builds src/lib/visa/h1b-employers.json from USCIS H-1B Employer Data Hub CSVs.
//
//   npm run visa:h1b -- [folder]      (default scripts/data/h1b, gitignored)
//
// Takes the yearly archive files (h1b_datahubexport-2023.csv) and the hub's "Crosstab" CSV
// exports alike: columns are found by name. Counts approved workers (new + continuing) per
// employer, keyed by employerKey(). Only employers with at least one approval are kept.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { employerKeys } from '../src/lib/visa/h1b'

/** One CSV row into cells (quotes, doubled quotes, commas inside quotes). */
export function csvRow(line: string): string[] {
  const out: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',' || ch === '\t') {
      out.push(cell)
      cell = ''
    } else cell += ch
  }
  out.push(cell)
  return out.map((c) => c.trim())
}

export interface H1bCounts {
  years: Set<number>
  employers: Map<string, number>
}

/** Adds one CSV file's text to the running counts. Throws when the columns aren't there. */
export function addCsv(text: string, into: H1bCounts, file = 'csv'): number {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  const head = csvRow(lines[0] ?? '').map((h) => h.toLowerCase())
  const name = head.findIndex((h) => /employer|petitioner/.test(h) && !/tax|city|state|zip/.test(h))
  const year = head.findIndex((h) => /fiscal year|^year$/.test(h))
  const approvals = head.map((h, i) => (/approv/.test(h) ? i : -1)).filter((i) => i >= 0)
  if (name < 0 || approvals.length === 0) throw new Error(`${file}: no employer or approval columns in: ${head.join(' | ')}`)
  let rows = 0
  for (const line of lines.slice(1)) {
    const cells = csvRow(line)
    const employer = cells[name]
    if (!employer) continue
    const n = approvals.reduce((sum, i) => sum + (Number((cells[i] ?? '').replace(/[,\s]/g, '')) || 0), 0)
    if (year >= 0) {
      const y = Number((cells[year] ?? '').match(/\d{4}/)?.[0])
      if (y) into.years.add(y)
    }
    if (n <= 0) continue
    for (const key of employerKeys(employer)) into.employers.set(key, (into.employers.get(key) ?? 0) + n)
    rows++
  }
  return rows
}

export function yearsLabel(years: Set<number>): string {
  const ys = [...years].sort()
  if (ys.length === 0) return 'recent years'
  return ys.length === 1 ? `FY${ys[0]}` : `FY${ys[0]}-FY${ys[ys.length - 1]}`
}

function main() {
  const dir = process.argv[2] ?? 'scripts/data/h1b'
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv'))
  if (files.length === 0) throw new Error(`No .csv files in ${dir}`)
  const counts: H1bCounts = { years: new Set(), employers: new Map() }
  for (const f of files) console.log(`${f}: ${addCsv(readFileSync(join(dir, f), 'utf8'), counts, f)} rows with approvals`)
  const employers = Object.fromEntries([...counts.employers].sort(([a], [b]) => (a < b ? -1 : 1)))
  const out = { years: yearsLabel(counts.years), employers }
  writeFileSync('src/lib/visa/h1b-employers.json', JSON.stringify(out) + '\n')
  console.log(`${out.years}: ${counts.employers.size} employers written to src/lib/visa/h1b-employers.json`)
}

if (process.argv[1]?.endsWith('build-h1b.ts')) main()
