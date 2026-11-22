// The landing page's example (hero card and "What a tailor looks like"). A restaurant
// general manager tailoring for an operations coordinator job: the resume is written in
// restaurant talk, the tailor says the same facts in the job's words. Laid out the way the
// Result card shows a tailor: rewritten bullets with a reason each, the fact check, and the
// posting's skills that weren't added because the resume doesn't support them.
//
// Rule for editing this: every number and claim on the "after" side must already be on
// the "before" side. No invented metrics. `jobWords` are the posting's words the rewrite
// uses; the page highlights them.
export const LANDING_EXAMPLE = {
  person: 'Marcus, restaurant general manager',
  job: 'Operations Coordinator at a property management company',
  summary: {
    before: 'Restaurant GM, 6 years running a busy dining room. Good with people, fast on my feet, keep costs down.',
    after:
      'Operations-minded general manager with 6 years coordinating vendors, schedules and a team of 28 in a high-volume business, with a steady focus on cost control.',
    why: 'The summary leads with what this job needs: coordination, vendors, scheduling.',
    jobWords: ['coordinating vendors, schedules', 'cost control'],
  },
  bullets: [
    {
      before: "Ran BOH ordering with our 5 food and bev vendors. Never 86'd anything on a Friday night.",
      after: 'Coordinated purchasing with 5 vendors and kept supplies stocked through peak weekend volume.',
      why: 'The posting asks for vendor coordination and inventory. Same facts, in its words.',
      jobWords: ['Coordinated purchasing', 'vendors', 'supplies stocked'],
    },
    {
      before: 'Did the schedule for all 28 FOH and BOH staff and covered call-outs.',
      after: 'Managed scheduling for a 28-person team and filled same-day staffing gaps.',
      why: 'Matches "manage schedules and coordinate coverage".',
      jobWords: ['Managed scheduling', 'staffing'],
    },
    {
      before: 'Dealt with angry guests and comps, kept our Google rating at 4.6.',
      after: 'Resolved customer escalations calmly while keeping public reviews at 4.6 stars.',
      why: 'The role handles resident escalations.',
      jobWords: ['Resolved customer escalations'],
    },
  ],
  factsKept: ['6 years', 'team of 28', '5 vendors', '4.6 stars'],
  notAdded: ['work order systems', 'property management software', 'lease administration'],
}

/** Split text into plain and highlighted parts, for the posting's words in a rewrite. */
export function highlightParts(text: string, words: string[]): { text: string; hit: boolean }[] {
  const ranges: [number, number][] = []
  for (const word of words) {
    const at = text.toLowerCase().indexOf(word.toLowerCase())
    if (at >= 0) ranges.push([at, at + word.length])
  }
  ranges.sort((a, b) => a[0] - b[0])
  const parts: { text: string; hit: boolean }[] = []
  let pos = 0
  for (const [start, end] of ranges) {
    if (start < pos) continue
    if (start > pos) parts.push({ text: text.slice(pos, start), hit: false })
    parts.push({ text: text.slice(start, end), hit: true })
    pos = end
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), hit: false })
  return parts
}
