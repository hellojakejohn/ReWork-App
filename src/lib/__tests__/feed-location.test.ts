import { describe, expect, it } from 'vitest'
import { locationCountry, usState } from '@/lib/feed/prefilter'

describe('usState abroad look-alikes', () => {
  it('reads foreign regions that share a US code as abroad', () => {
    expect(usState('Amsterdam, NH')).toBeNull()
    expect(usState('Perth, WA')).toBeNull()
    expect(usState('Chennai, TN')).toBeNull()
    expect(locationCountry('Amsterdam, NH')).toBe('other')
    expect(usState('Toronto, Ontario, Canada')).toBeNull()
    expect(usState('Bengaluru, Karnataka, India')).toBeNull()
  })
  it('keeps real US twins and US states named like countries', () => {
    expect(usState('Amsterdam, NY')).toBe('NY')
    expect(usState('Paris, TX')).toBe('TX')
    expect(usState('Seattle, WA')).toBe('WA')
    expect(usState('Nashville, TN')).toBe('TN')
    expect(usState('Albuquerque, New Mexico')).toBe('NM')
    expect(usState('Boston, MA (New England)')).toBe('MA')
    expect(usState('Indianapolis, Indiana')).toBe('IN')
    expect(locationCountry('Remote, United States or India')).toBe('us')
  })
})
