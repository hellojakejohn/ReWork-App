// Debug (free, no model calls): why a person's Workday jobs do or don't reach the list.
import { readFileSync } from 'node:fs'
import { masterToParsed } from '@/lib/master-resume'
import { searchWorkday, workdayQueries, searchTitles, placeFilter } from '@/lib/feed/match'
import { prescore, resumeProfile, usState, titleFit } from '@/lib/feed/prefilter'

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = new Map<string, any>()
const db: any = {
  job: {
    findMany: async () => [...rows.values()],
    createMany: async ({ data }: any) => { for (const d of data) rows.set(d.id, { closedAt: null, ...d }); return { count: data.length } },
    updateMany: async () => ({ count: 0 }),
  },
}
async function main() {
  const who = process.argv[2]
  const fx = JSON.parse(readFileSync(`scripts/fixtures/people/${who}.json`, 'utf8'))
  const resume = masterToParsed(fx.resume)
  resume.contact.location = 'Saint Paul, MN'
  const prefs = { targetTitles: [fx.job.title], workplace: 'both' as const }
  const titles = searchTitles(resume, prefs)
  const home = usState(resume.contact.location)
  const q = workdayQueries(titles, 'both', home)
  const n = await searchWorkday(db, q)
  const profile = resumeProfile(resume, { targetTitles: prefs.targetTitles })
  console.log(`${who}: queries ${JSON.stringify(q)}, workday ${n}, titleWords ${[...profile.titleWords].join(',')}`)
  const pf = placeFilter('both', home) as any
  for (const r of rows.values()) {
    const inPlace = r.remote || r.usState === home
    const s = prescore({ title: r.title, location: r.location, description: '' }, profile)
    console.log(`${inPlace ? 'IN ' : 'out'} t${String(s.title).padStart(3)} pre${String(Math.round(s.title * 0.6)).padStart(3)} fit${String(titleFit(r.title, profile)).padStart(3)} ${r.company} | ${r.title} | ${r.location} | st=${r.usState} rem=${r.remote}`)
  }
  void pf
}
main()
