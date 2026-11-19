import { describe, expect, it } from 'vitest'
import { proWelcome, PRO_WELCOME_HIGHLIGHTS } from '@/lib/pro-welcome'
import { NO_ACCESS, type Access } from '@/lib/entitlement-rules'

const pass: Access = { ...NO_ACCESS, isPro: true, source: 'STRIPE_PASS', endsAt: '2027-02-16T18:00:00.000Z', daysLeft: 90 }

describe('proWelcome', () => {
  it('greets by first name and says the pass never renews', () => {
    const w = proWelcome(pass, 'Stevie Jensen')
    expect(w.title).toBe("You're Pro, Stevie.")
    expect(w.detail).toBe("Your Job Hunt Pass runs until Feb 16. It never renews, so there's nothing to cancel.")
  })

  it('works without a name', () => {
    expect(proWelcome(pass, null).title).toBe("You're Pro.")
    expect(proWelcome(pass, '  ').title).toBe("You're Pro.")
  })

  it('tells monthly subscribers when it renews and how to cancel', () => {
    const w = proWelcome({ ...pass, source: 'STRIPE_SUBSCRIPTION', endsAt: '2026-12-18T18:00:00.000Z' }, 'Sam')
    expect(w.detail).toBe('Pro Monthly renews Dec 18. Cancel any time from Manage billing.')
  })

  it('has four highlights and no em-dashes', () => {
    expect(PRO_WELCOME_HIGHLIGHTS).toHaveLength(4)
    expect(PRO_WELCOME_HIGHLIGHTS.every(Boolean)).toBe(true)
    const all = [...PRO_WELCOME_HIGHLIGHTS, proWelcome(pass, 'A').detail].join(' ')
    expect(all).not.toContain('—')
  })
})
