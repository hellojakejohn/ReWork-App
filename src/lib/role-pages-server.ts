// DB reads for the public role pages, cached for 6 hours (the pull runs once a day).
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { MIN_ROLE_JOBS, ROLES, roleBySlug, summarizeRole, titleInRole, type RoleDef, type RoleJob, type RoleSummary } from '@/lib/role-pages'

const SIX_HOURS = 6 * 3600

async function jobsFor(role: RoleDef): Promise<RoleJob[]> {
  const rows = await prisma.job.findMany({
    where: { closedAt: null, country: { not: 'other' }, OR: role.any.map((a) => ({ title: { contains: a.trim(), mode: 'insensitive' as const } })) },
    select: { title: true, company: true, location: true, remote: true, usState: true, payLabel: true, postedAt: true, firstSeenAt: true, url: true },
    orderBy: { firstSeenAt: 'desc' },
    take: 3000,
  })
  return rows.filter((r) => titleInRole(r.title, role))
}

export interface RolePageData {
  role: RoleDef
  summary: RoleSummary
  updatedAt: string
}

async function loadRole(slug: string): Promise<RolePageData | null> {
  const role = roleBySlug(slug)
  if (!role) return null
  try {
    const jobs = await jobsFor(role)
    if (jobs.length < MIN_ROLE_JOBS) return null
    // Dates survive the cache as strings; summarize before caching.
    return { role, summary: summarizeRole(jobs), updatedAt: new Date().toISOString() }
  } catch (error) {
    console.error('[role-pages] load failed:', (error as Error)?.message)
    return null
  }
}

export const getRolePage = unstable_cache(loadRole, ['role-page-v3'], { revalidate: SIX_HOURS })

async function loadIndex(): Promise<{ slug: string; title: string; count: number }[]> {
  // One read of every open title, then each role counted in memory.
  let titles: string[]
  try {
    titles = (await prisma.job.findMany({ where: { closedAt: null, country: { not: 'other' } }, select: { title: true } })).map((j) => j.title)
  } catch {
    return []
  }
  return ROLES.map((role) => ({ slug: role.slug, title: role.title, count: titles.filter((t) => titleInRole(t, role)).length }))
    .filter((r) => r.count >= MIN_ROLE_JOBS)
    .sort((a, b) => b.count - a.count)
}

export const getRoleIndex = unstable_cache(loadIndex, ['role-index-v2'], { revalidate: SIX_HOURS })
