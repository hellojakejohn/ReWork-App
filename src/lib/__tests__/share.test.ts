import { describe, expect, it } from 'vitest'
import { parseShare, shareDetail, shareImagePath, shareText, shareUrl, type ShareCard } from '@/lib/share'

const fit: ShareCard = { kind: 'fit', score: 40, fits: 5, otherWords: 1, alterations: 8 }
const tailor: ShareCard = { kind: 'tailor', before: 40, after: 63, kept: 9 }

describe('share cards', () => {
  it('round-trips through the link', () => {
    for (const card of [fit, tailor]) {
      const url = new URL(shareUrl('https://rework.careers/', card))
      expect(url.pathname).toBe('/s')
      expect(url.searchParams.get('ref')).toBe('share')
      expect(parseShare(url.searchParams)).toEqual(card)
    }
    expect(shareImagePath(fit)).toBe('/api/og/share?k=fit&s=40&f=5&o=1&m=8')
  })

  it('rejects anything that is not a small number', () => {
    expect(parseShare(new URLSearchParams('k=fit&s=140&f=5&o=1&m=8'))).toBeNull()
    expect(parseShare(new URLSearchParams('k=fit&s=40&f=5&o=1'))).toBeNull()
    expect(parseShare(new URLSearchParams('k=tailor&b=40&a=<script>&n=9'))).toBeNull()
    expect(parseShare(new URLSearchParams('k=other'))).toBeNull()
  })

  it('shares numbers only, with no em-dashes', () => {
    expect(shareText(fit)).toContain('40% fit')
    expect(shareText(tailor)).toContain('40% to 63%')
    expect(shareText(fit) + shareText(tailor)).not.toContain('—')
  })
})

describe('share detail', () => {
  it('says what the numbers mean', () => {
    expect(shareDetail(fit)).toBe('The resume already shows 6 of the 14 skills this job asks for. 8 to add or prove.')
    expect(shareDetail(tailor)).toBe('9 lines rewritten for the job, each checked against the real resume. Nothing made up.')
  })
})


describe('milestone cards', () => {
  const ms: ShareCard = { kind: 'milestone', stage: 'interview', nth: 1, applied: 14, interviews: 1, offers: 0 }
  it('round-trips and reads well', () => {
    expect(parseShare(new URL(shareUrl('https://rework.careers', ms)).searchParams)).toEqual(ms)
    expect(shareDetail(ms)).toBe('After 14 applications, each resume tailored to the job. Nothing made up.')
    expect(parseShare(new URLSearchParams('k=ms&st=x&x=1&p=1&iv=1&of=0'))).toBeNull()
    expect(parseShare(new URLSearchParams('k=ms&st=i&x=0&p=1&iv=1&of=0'))).toBeNull()
  })
})
