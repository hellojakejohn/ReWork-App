// "Skills that would open the most jobs": the skills missing across a person's matches,
// counted per job. Pure, runs in the browser on the feed it already has.

export interface SkillDemand {
  skill: string
  /** Matches that ask for it and the resume doesn't show it. */
  jobs: number
  /** Matches counted. */
  of: number
}

const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** Top skills by how many matches miss them (at least `min`), ties to the closer matches. */
export function skillDemand(matches: { missing: string[]; score: number }[], top = 5, min = 2): SkillDemand[] {
  const tally = new Map<string, { skill: string; jobs: number; scoreSum: number }>()
  for (const m of matches) {
    const seen = new Set<string>()
    for (const raw of m.missing) {
      const k = key(raw)
      if (!k || seen.has(k)) continue
      seen.add(k)
      const t = tally.get(k) ?? { skill: raw.trim(), jobs: 0, scoreSum: 0 }
      t.jobs += 1
      t.scoreSum += m.score
      tally.set(k, t)
    }
  }
  return [...tally.values()]
    .filter((t) => t.jobs >= min)
    .sort((a, b) => b.jobs - a.jobs || b.scoreSum / b.jobs - a.scoreSum / a.jobs || a.skill.localeCompare(b.skill))
    .slice(0, top)
    .map((t) => ({ skill: t.skill, jobs: t.jobs, of: matches.length }))
}
