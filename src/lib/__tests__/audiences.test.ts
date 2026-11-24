import { describe, expect, it } from 'vitest'
import { AUDIENCES, audienceBySlug } from '@/lib/audiences'

const numbers = (s: string) => s.match(/\d+(?:\.\d+)?/g) ?? []

describe('audiences', () => {
  it('slugs are unique and findable', () => {
    const slugs = AUDIENCES.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(audienceBySlug(s)?.slug).toBe(s)
  })

  it('examples only use numbers already in the original line', () => {
    for (const a of AUDIENCES) {
      const before = new Set(numbers(a.example.before))
      for (const n of numbers(a.example.after)) expect(before, `${a.slug}: ${n}`).toContain(n)
    }
  })

  it('no em-dashes in the copy', () => {
    expect(JSON.stringify(AUDIENCES)).not.toMatch(/—/)
  })
})
