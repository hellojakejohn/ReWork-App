import { describe, expect, it } from 'vitest'
import { clip, clipList, httpUrlOrNull } from '@/lib/input'

describe('input helpers', () => {
  it('clips strings and ignores non-strings', () => {
    expect(clip('  abc  ', 2)).toBe('ab')
    expect(clip(42, 10)).toBe('')
    expect(clipList(['a', '', 'bbbb', 3, 'c'], 2, 2)).toEqual(['a', 'bb'])
    expect(clipList('nope', 2, 2)).toEqual([])
  })

  it('keeps only http(s) job links', () => {
    expect(httpUrlOrNull('https://jobs.example.com/1')).toBe('https://jobs.example.com/1')
    expect(httpUrlOrNull('HTTP://x.test')).toBe('HTTP://x.test')
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', '//x.test', 'ftp://x.test', 'https://', '', null, 7]) {
      expect(httpUrlOrNull(bad)).toBeNull()
    }
    expect(httpUrlOrNull(`https://x.test/${'a'.repeat(3000)}`)!.length).toBe(2000)
  })
})
