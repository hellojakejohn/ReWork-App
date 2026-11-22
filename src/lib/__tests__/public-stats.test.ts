import { describe, expect, it } from 'vitest'
import { pickTicker, tickerTitle } from '@/lib/feed/public-stats'

describe('tickerTitle', () => {
  it('trims locations, parentheses and req numbers', () => {
    expect(tickerTitle('Delivery Driver (Part Time) - Store #4521, Austin TX')).toBe('Delivery Driver')
    expect(tickerTitle('Line Cook | Downtown')).toBe('Line Cook')
  })
  it('drops placeholders and long titles', () => {
    expect(tickerTitle('Internal')).toBeNull()
    expect(tickerTitle('General Application')).toBeNull()
    expect(tickerTitle('Join our Talent Community')).toBeNull()
    expect(tickerTitle('x'.repeat(60))).toBeNull()
    expect(tickerTitle('Bartender')).toBe('Bartender')
  })
})

describe('pickTicker', () => {
  it('keeps one job per employer and stops at the limit', () => {
    const rows = [
      { title: 'Cashier', company: 'Target' },
      { title: 'Stocker', company: 'target' },
      { title: 'Internal', company: 'Acme' },
      { title: 'Nurse', company: 'Mayo' },
      { title: 'Driver', company: "Domino's" },
    ]
    expect(pickTicker(rows, 2)).toEqual([
      { title: 'Cashier', company: 'Target' },
      { title: 'Nurse', company: 'Mayo' },
    ])
  })
})
