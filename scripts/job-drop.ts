// Weekly job drop for Jake's posts: good, recent, varied jobs from the feed as paste-ready
// text. Read-only. npx tsx --tsconfig tsconfig.json scripts/job-drop.ts [--count 10] [--role <slug>]
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { PrismaClient } from '@prisma/client'
import { ROLES, titleInRole } from '@/lib/role-pages'
import { payFromText } from '@/lib/pay'

const db = new PrismaClient()
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const count = Number(arg('count') ?? 10)
const onlyRole = arg('role')
const SITE = 'rework.careers'

/** Skip misread pay ("$250 an hour" for a keyholder). */
function plausiblePay(label: string | null): boolean {
  const p = payFromText(label)
  if (!p || p.min == null) return false
  const max = p.max ?? p.min
  return p.period === 'hour' ? p.min >= 7 && max <= 150 : p.period === 'year' ? p.min >= 15_000 && max <= 1_000_000 : false
}

/** The first place only: some boards list ten cities. */
function firstPlace(location: string): string {
  const parts = location.split(',').map((p) => p.trim())
  return parts.length > 4 ? `${parts.slice(0, 2).join(', ')} (and more)` : location
}

async function main() {
  const since = new Date(Date.now() - 10 * 86_400_000)
  const jobs = await db.job.findMany({
    // Pay listed, US or remote, seen in the last 10 days: the ones worth a stranger's click.
    where: { closedAt: null, firstSeenAt: { gte: since }, payLabel: { not: null }, country: { not: 'other' }, source: { not: 'adzuna' } },
    select: { title: true, company: true, location: true, remote: true, payLabel: true, url: true },
    orderBy: { firstSeenAt: 'desc' },
    take: 5000,
  })
  const roles = onlyRole ? ROLES.filter((r) => r.slug === onlyRole) : ROLES
  const picked: { role: string; slug: string; job: (typeof jobs)[number] }[] = []
  const companies = new Set<string>()
  // One per role first, then fill; never two from one employer. Non-tech roles lead the list.
  for (const pass of [1, 2, 3]) {
    for (const role of roles) {
      if (picked.length >= count) break
      if (picked.filter((p) => p.slug === role.slug).length >= pass) continue
      const job = jobs.find((j) => titleInRole(j.title, role) && !companies.has(j.company.toLowerCase()) && plausiblePay(j.payLabel))
      if (!job) continue
      companies.add(job.company.toLowerCase())
      picked.push({ role: role.title, slug: role.slug, job })
    }
  }
  const lines = picked.map(({ job, slug }, i) => {
    const loc = firstPlace(job.location)
    const place = job.remote && !/remote/i.test(loc) ? `${loc}, Remote` : loc
    return `${i + 1}. ${job.title} at ${job.company} (${place}) ${job.payLabel}\n   ${job.url}\n   More like it: ${SITE}/jobs/${slug}`
  })
  console.log(`This week's job drop: ${picked.length} open jobs that list pay, straight from employers' own boards.\n`)
  console.log(lines.join('\n\n'))
  console.log(`\nBefore you apply: check it's still real (${SITE}/check) and how your resume fits (${SITE}/fit). Both free.`)
}
main().finally(() => db.$disconnect())
