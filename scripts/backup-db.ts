// Weekly database backup while Supabase is on the free tier (no automatic backups there).
// Read-only: one SELECT per table, written as gzipped JSON to a folder OUTSIDE the repo
// (default ~/ReWork-backups), because it holds users' resumes and emails.
//
// Run:      npm run backup
// Folder:   BACKUP_DIR=/some/folder npm run backup
// Skipped:  sessions and verification tokens (sign-ins, worthless in a restore) and jobs
//           (re-pulled daily from the boards). Uploaded resume files live in Supabase
//           Storage and are not in this file; the parsed resumes are.
//
// Restore (by hand, into an empty database with the same schema): insert the tables in
// the order below, users first. Moving to Supabase Pro ($25/mo, daily backups) replaces
// this script once revenue covers it.
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

process.loadEnvFile()

// Parent tables before children, so a restore can go top to bottom.
const TABLES = [
  'users',
  'accounts',
  'resumes',
  'resume_versions',
  'job_applications',
  'entitlements',
  'ai_cap_overrides',
  'feed_prefs',
  'job_matches',
  'feedback',
  'stripe_events',
  'events',
] as const

async function main() {
  const prisma = new PrismaClient()
  const dir = process.env.BACKUP_DIR || join(homedir(), 'ReWork-backups')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const out: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}
  try {
    for (const table of TABLES) {
      // Table names come from the fixed list above, never from input.
      const rows = await prisma.$queryRawUnsafe<{ rows: unknown[] | null }[]>(`SELECT json_agg(t) AS rows FROM "${table}" t`)
      out[table] = rows[0]?.rows ?? []
      counts[table] = out[table].length
    }
  } finally {
    await prisma.$disconnect()
  }
  const stamp = new Date().toISOString().slice(0, 10)
  const file = join(dir, `rework-${stamp}.json.gz`)
  const body = JSON.stringify({ takenAt: new Date().toISOString(), tables: TABLES, counts, data: out })
  writeFileSync(file, gzipSync(body), { mode: 0o600 })
  console.log(`Backup written: ${file} (${(Buffer.byteLength(body) / 1e6).toFixed(1)} MB before gzip)`)
  console.table(counts)
}

main().catch((error) => {
  console.error('Backup failed:', error)
  process.exit(1)
})
