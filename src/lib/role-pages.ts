// Public job pages per role (/jobs/[role]): live numbers from the jobs we pull every
// morning from employers' own boards. Real data or nothing: a role with too few open jobs
// isn't shown. Pure helpers here; the DB read lives in role-pages-server.ts.
import { payFromText } from '@/lib/pay'
import { stateName } from '@/lib/feed/prefilter'

export interface RoleDef {
  slug: string
  title: string
  /** Case-insensitive substrings a job title must contain (any). */
  any: string[]
  /** Titles that contain one of `any` but are a different job. */
  not?: RegExp
  /** One honest line about the role for the page intro. */
  intro: string
}

// Picked from the most common titles in the feed (Nov 2026), weighted to our users:
// non-tech and career changers first, then the big tech roles.
export const ROLES: RoleDef[] = [
  { slug: 'customer-service-representative', title: 'Customer Service Representative', any: ['customer service rep', 'customer service representative', 'customer service associate', 'customer support representative'], intro: 'Front-line roles helping customers by phone, chat or in person.' },
  { slug: 'operations-coordinator', title: 'Operations Coordinator', any: ['operations coordinator', 'ops coordinator', 'logistics coordinator', 'operations assistant', 'dispatch coordinator', 'fulfillment coordinator'], not: /\b(people|hr|talent|legal|securities|investment|revenue|sales|marketing|clinical|director|manager)\b/i, intro: 'Keeping schedules, vendors, inventory and teams running. A common next step for restaurant and retail managers.' },
  { slug: 'operations-manager', title: 'Operations Manager', any: ['operations manager'], not: /\b(director|vp|vice president|people|hr|revenue|sales|marketing|legal)\b/i, intro: 'Running the day-to-day of a site, team or process.' },
  { slug: 'restaurant-manager', title: 'Restaurant Manager', any: ['restaurant manager', 'restaurant leader', 'restaurant general manager', 'kitchen manager'], intro: 'Leading a restaurant shift, kitchen or whole location.' },
  { slug: 'assistant-manager', title: 'Assistant Manager', any: ['assistant manager', 'assistant store manager', 'assistant restaurant manager'], intro: 'Second-in-command roles in stores, restaurants and branches.' },
  { slug: 'store-manager', title: 'Store Manager', any: ['store manager', 'store leader'], not: /\bassistant\b/i, intro: 'Running a retail store: people, sales, inventory.' },
  { slug: 'retail-sales-associate', title: 'Retail Sales Associate', any: ['retail sales associate', 'sales associate', 'retail associate', 'key holder', 'keyholder', 'style advisor', 'stylist'], not: /\b(manager|director)\b/i, intro: 'Helping customers on the floor, at the register and with stock.' },
  { slug: 'delivery-driver', title: 'Delivery Driver', any: ['delivery driver', 'delivery associate', 'courier', 'delivery expert'], intro: 'Local delivery routes, from parcels to groceries.' },
  { slug: 'truck-driver', title: 'Truck Driver (CDL)', any: ['truck driver', 'cdl'], intro: 'CDL driving jobs, local and over the road.' },
  { slug: 'warehouse-associate', title: 'Warehouse Associate', any: ['warehouse associate', 'warehouse worker', 'logistics associate', 'material handler', 'fulfillment associate'], intro: 'Picking, packing, receiving and shipping.' },
  { slug: 'automotive-technician', title: 'Automotive Technician', any: ['automotive technician', 'auto technician', 'service technician', 'brake and tire', 'lube technician', 'mechanic'], not: /\b(manager|director)\b/i, intro: 'Diagnosing and fixing vehicles, from entry level to master tech.' },
  { slug: 'maintenance-technician', title: 'Maintenance Technician', any: ['maintenance technician', 'maintenance tech', 'facilities technician'], intro: 'Keeping buildings, equipment and production lines working.' },
  { slug: 'executive-assistant', title: 'Executive Assistant', any: ['executive assistant', 'administrative assistant', 'office manager'], intro: 'Calendars, travel, communication and keeping a team organized.' },
  { slug: 'recruiter', title: 'Recruiter', any: ['recruiter', 'talent acquisition', 'sourcer'], not: /\b(director|vp|head of)\b/i, intro: 'Finding and hiring people, for tech and every other field.' },
  { slug: 'project-manager', title: 'Project Manager', any: ['project manager', 'project coordinator'], not: /\b(director|vp)\b/i, intro: 'Plans, timelines, budgets and getting things finished.' },
  { slug: 'program-manager', title: 'Program Manager', any: ['program manager'], not: /\b(director|vp)\b/i, intro: 'Coordinating many projects toward one goal.' },
  { slug: 'customer-success-manager', title: 'Customer Success Manager', any: ['customer success', 'client success', 'account manager'], not: /\b(director|vp|head of)\b/i, intro: 'Keeping customers happy after the sale. A common move from retail and hospitality.' },
  { slug: 'account-executive', title: 'Account Executive', any: ['account executive', 'sales executive'], not: /\b(director|vp)\b/i, intro: 'Closing sales, from small business to enterprise.' },
  { slug: 'sales-development-representative', title: 'Sales Development Representative', any: ['sales development rep', 'business development rep', 'sdr', 'bdr'], intro: 'The usual first job in tech sales: finding and booking new customers.' },
  { slug: 'marketing-manager', title: 'Marketing Manager', any: ['marketing manager', 'marketing specialist', 'marketing coordinator'], not: /\b(director|vp)\b/i, intro: 'Campaigns, content, product marketing and growth.' },
  { slug: 'financial-analyst', title: 'Financial Analyst', any: ['financial analyst', 'finance analyst', 'fp&a'], intro: 'Budgets, forecasts and reports.' },
  { slug: 'accountant', title: 'Accountant', any: ['accountant', 'accounting specialist', 'bookkeeper', 'accounts payable', 'accounts receivable'], not: /\b(director|vp)\b/i, intro: 'Books, payables, receivables and close.' },
  { slug: 'data-analyst', title: 'Data Analyst', any: ['data analyst', 'business analyst', 'analytics analyst', 'business intelligence'], intro: 'SQL, dashboards and answering questions with data.' },
  { slug: 'data-scientist', title: 'Data Scientist', any: ['data scientist'], intro: 'Models, experiments and statistics.' },
  { slug: 'data-engineer', title: 'Data Engineer', any: ['data engineer', 'analytics engineer'], intro: 'Pipelines and warehouses that the analysts rely on.' },
  { slug: 'software-engineer', title: 'Software Engineer', any: ['software engineer', 'software developer', 'full stack', 'backend engineer', 'frontend engineer', 'front end engineer'], not: /\b(manager|director|vp)\b/i, intro: 'Building software, from new grad to staff.' },
  { slug: 'machine-learning-engineer', title: 'Machine Learning Engineer', any: ['machine learning engineer', 'ml engineer', 'ai engineer'], not: /\b(manager|director)\b/i, intro: 'Training, shipping and running ML and AI systems.' },
  { slug: 'product-manager', title: 'Product Manager', any: ['product manager'], not: /\b(director|vp|marketing)\b/i, intro: 'Deciding what gets built and why.' },
  { slug: 'product-designer', title: 'Product Designer', any: ['product designer', 'ux designer', 'ui designer', 'ux researcher'], intro: 'Designing how products look and work.' },
  { slug: 'mechanical-engineer', title: 'Mechanical Engineer', any: ['mechanical engineer', 'manufacturing engineer'], intro: 'Designing and building physical products and lines.' },
  { slug: 'electrical-engineer', title: 'Electrical Engineer', any: ['electrical engineer', 'hardware engineer'], intro: 'Circuits, power and hardware.' },
  { slug: 'nurse-practitioner', title: 'Nurse Practitioner', any: ['nurse practitioner', 'physician assistant'], intro: 'Advanced practice roles, many remote or telehealth.' },
  { slug: 'registered-nurse', title: 'Registered Nurse', any: ['registered nurse', 'rn', 'nurse case manager', 'clinical nurse'], not: /\bpractitioner\b/i, intro: 'Clinical and care-management nursing roles.' },
  { slug: 'therapist', title: 'Therapist', any: ['therapist', 'counselor', 'psychologist', 'social worker'], not: /\b(massage|physical|occupational)\b/i, intro: 'Mental health roles, many with telehealth options.' },
  { slug: 'personal-trainer', title: 'Personal Trainer', any: ['personal trainer', 'fitness instructor', 'pilates instructor', 'yoga instructor', 'coach'], not: /\b(manager|director|sales|career|executive)\b/i, intro: 'Training clients one on one and in classes.' },
]

export const MIN_ROLE_JOBS = 8

export function roleBySlug(slug: string): RoleDef | null {
  return ROLES.find((r) => r.slug === slug) ?? null
}

/** Does this job title belong to the role? */
const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const termRes = new Map<string, RegExp>()
/** Whole words only: "mechanic" is not "Mechanical Engineer", "rn" is not "Western". */
function termRe(term: string): RegExp {
  let re = termRes.get(term)
  if (!re) {
    re = new RegExp(`(?<![a-z0-9])${escape(term.trim().toLowerCase())}(?![a-z0-9])`, 'i')
    termRes.set(term, re)
  }
  return re
}

export function titleInRole(title: string, role: RoleDef): boolean {
  return role.any.some((a) => termRe(a).test(title)) && !(role.not && role.not.test(title))
}

export interface RoleJob {
  title: string
  company: string
  location: string
  remote: boolean
  usState: string | null
  payLabel: string | null
  postedAt: Date | null
  firstSeenAt: Date
  url: string
}

export interface RoleSummary {
  count: number
  remoteShare: number
  payShare: number
  /** Typical yearly pay where listed: medians of the lows and highs. */
  yearly: { low: number; high: number; n: number } | null
  hourly: { low: number; high: number; n: number } | null
  topStates: { state: string; n: number }[]
  topCompanies: { company: string; n: number }[]
  /** How many different employers. */
  employers: number
  /** Newest first, at most 3 per employer so one big hirer can't fill the list. */
  newest: RoleJob[]
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function topN<T extends string>(xs: T[], n: number): { key: T; n: number }[] {
  const m = new Map<T, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([key, n]) => ({ key, n }))
}

function capPerCompany(jobs: RoleJob[], cap: number): RoleJob[] {
  const seen = new Map<string, number>()
  return jobs.filter((j) => {
    const k = j.company.trim().toLowerCase()
    const n = (seen.get(k) ?? 0) + 1
    seen.set(k, n)
    return n <= cap
  })
}

export function summarizeRole(jobs: RoleJob[], newest = 20): RoleSummary {
  const yearlyLows: number[] = []
  const yearlyHighs: number[] = []
  const hourlyLows: number[] = []
  const hourlyHighs: number[] = []
  for (const j of jobs) {
    const p = j.payLabel ? payFromText(j.payLabel) : null
    if (!p || p.min == null) continue
    const max = p.max ?? p.min
    if (p.period === 'year' && p.min >= 15_000 && max <= 1_500_000) {
      yearlyLows.push(p.min)
      yearlyHighs.push(max)
    } else if (p.period === 'hour' && p.min >= 7 && max <= 150) {
      hourlyLows.push(p.min)
      hourlyHighs.push(max)
    }
  }
  const range = (lo: number[], hi: number[]) => (lo.length >= 3 ? { low: median(lo), high: median(hi), n: lo.length } : null)
  return {
    count: jobs.length,
    remoteShare: jobs.length ? jobs.filter((j) => j.remote).length / jobs.length : 0,
    payShare: jobs.length ? jobs.filter((j) => j.payLabel).length / jobs.length : 0,
    yearly: range(yearlyLows, yearlyHighs),
    hourly: range(hourlyLows, hourlyHighs),
    topStates: topN(jobs.map((j) => j.usState).filter((s): s is string => !!s), 5).map(({ key, n }) => ({ state: stateName(key) ?? key, n })),
    topCompanies: topN(jobs.map((j) => j.company.trim()).filter(Boolean), 8).map(({ key, n }) => ({ company: key, n })),
    employers: new Set(jobs.map((j) => j.company.trim().toLowerCase())).size,
    newest: capPerCompany([...jobs].sort((a, b) => (b.postedAt ?? b.firstSeenAt).getTime() - (a.postedAt ?? a.firstSeenAt).getTime()), 3).slice(0, newest),
  }
}

export function money(n: number, period: 'year' | 'hour'): string {
  return period === 'hour' ? `$${n % 1 ? n.toFixed(2) : n}` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
}
