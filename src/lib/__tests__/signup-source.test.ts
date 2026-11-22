import { describe, expect, it } from 'vitest'
import { cleanTag, decodeSource, encodeSource, referrerSource, shouldRemember, sourceFromVisit, sourceProps } from '@/lib/signup-source'
import { signupSourceRows } from '@/lib/admin-analytics'

const url = (s: string) => new URL(s)

describe('sourceFromVisit', () => {
  it('prefers ?ref, then utm_source, and keeps medium, campaign and the landing path', () => {
    expect(sourceFromVisit(url('https://rework.careers/?ref=X&utm_source=li'), null)).toEqual({ s: 'x', p: '/', t: true })
    expect(sourceFromVisit(url('https://rework.careers/pricing?utm_source=LinkedIn&utm_medium=social&utm_campaign=Launch%20Day'), null)).toEqual({
      s: 'linkedin',
      m: 'social',
      c: 'launchday',
      p: '/pricing',
      t: true,
    })
  })

  it('falls back to the referring site, then direct', () => {
    expect(sourceFromVisit(url('https://rework.careers/'), 'https://t.co/abc')).toEqual({ s: 'x', p: '/' })
    expect(sourceFromVisit(url('https://rework.careers/'), 'https://www.reddit.com/r/SideProject/comments/1')).toMatchObject({ s: 'reddit' })
    expect(sourceFromVisit(url('https://rework.careers/'), 'https://www.google.co.uk/')).toMatchObject({ s: 'google' })
    expect(sourceFromVisit(url('https://rework.careers/'), 'https://somecoach.blog/post?x=1')).toMatchObject({ s: 'somecoach.blog' })
    expect(sourceFromVisit(url('https://rework.careers/'), null)).toMatchObject({ s: 'direct' })
  })

  it('ignores our own pages as a referrer', () => {
    expect(referrerSource('https://rework.careers/pricing', 'rework.careers')).toBeNull()
    expect(referrerSource('https://www.rework.careers/', 'rework.careers')).toBeNull()
    expect(referrerSource('not a url', 'rework.careers')).toBeNull()
  })
})

describe('cookie round trip', () => {
  it('encodes and decodes, and rejects junk', () => {
    const v = sourceFromVisit(url('https://rework.careers/?ref=coach_amy'), null)
    expect(decodeSource(encodeSource(v))).toEqual(v)
    expect(decodeSource('%7Bnope')).toBeNull()
    expect(decodeSource(encodeURIComponent(JSON.stringify({ s: '<script>' })))).toEqual({ s: 'script' })
    expect(decodeSource(encodeURIComponent(JSON.stringify({ s: 'x', p: 'https://evil' })))).toEqual({ s: 'x' })
  })

  it('caps tags at 40 safe characters', () => {
    expect(cleanTag('A'.repeat(60))).toHaveLength(40)
    expect(cleanTag('  ')).toBeUndefined()
  })
})

describe('shouldRemember', () => {
  const direct = { s: 'direct' }
  const tagged = { s: 'x', t: true }
  it('keeps the first touch unless a tagged link follows an untagged visit', () => {
    expect(shouldRemember(null, direct)).toBe(true)
    expect(shouldRemember(direct, tagged)).toBe(true)
    expect(shouldRemember(tagged, { s: 'reddit', t: true })).toBe(false)
    expect(shouldRemember(direct, { s: 'google' })).toBe(false)
  })
})

describe('sourceProps', () => {
  it('is "unknown" with no cookie', () => {
    expect(sourceProps(null)).toEqual({ source: 'unknown' })
    expect(sourceProps({ s: 'x', c: 'launch', p: '/' })).toEqual({ source: 'x', campaign: 'launch', landing: '/' })
  })
})

describe('signupSourceRows', () => {
  it('counts signups, tailors and payers per source, payers first', () => {
    const rows = signupSourceRows(
      [
        { userId: 'a', props: { source: 'x' } },
        { userId: 'b', props: { source: 'x' } },
        { userId: 'c', props: { source: 'linkedin' } },
        { userId: 'd', props: { provider: 'google' } },
        { userId: 'a', props: { source: 'x' } },
      ],
      new Set(['a', 'c']),
      new Set(['c'])
    )
    expect(rows).toEqual([
      { source: 'linkedin', signups: 1, tailored: 1, paid: 1 },
      { source: 'x', signups: 2, tailored: 1, paid: 0 },
      { source: 'unknown', signups: 1, tailored: 0, paid: 0 },
    ])
  })
})
