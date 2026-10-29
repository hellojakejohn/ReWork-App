import { describe, expect, it } from 'vitest'
import { cleanJobTitle, otherCompanyNamed, sameCompany } from '@/lib/job-checks'

describe('cleanJobTitle', () => {
  it('drops a trailing company name', () => {
    expect(cleanJobTitle('Senior Product Designer - CoinMarketCap', 'CoinMarketCap')).toBe('Senior Product Designer')
    expect(cleanJobTitle('Backend Engineer | Acme, Inc.', 'Acme')).toBe('Backend Engineer')
    expect(cleanJobTitle('Designer at Acme', 'Acme')).toBe('Designer')
  })
  it('keeps titles that only look like it', () => {
    expect(cleanJobTitle('Engineer - Payments', 'Acme')).toBe('Engineer - Payments')
    expect(cleanJobTitle('Front-End Engineer', 'End')).toBe('Front-End Engineer')
    expect(cleanJobTitle('Designer - Acme', '')).toBe('Designer - Acme')
  })
})

describe('sameCompany', () => {
  it('ignores case and suffixes', () => {
    expect(sameCompany('TripQuest Inc.', 'tripquest')).toBe(true)
    expect(sameCompany('Coinglass', 'CoinMarketCap')).toBe(false)
  })
})

describe('otherCompanyNamed', () => {
  const ad = `About the Role
As a Senior Product Designer at Coinglass, you will own the end-to-end product experience for core Coinglass products.
Key Responsibilities
Lead end-to-end product design for Coinglass core products. Join Coinglass and shape how traders see the market.`

  it('finds the company a reposted ad names', () => {
    expect(otherCompanyNamed(ad, 'CoinMarketCap')).toBe('Coinglass')
  })
  it('stays quiet when the ad names the same company', () => {
    expect(otherCompanyNamed(ad, 'Coinglass')).toBeNull()
    expect(otherCompanyNamed(ad.replace(/Coinglass/g, 'CoinMarketCap'), 'CoinMarketCap')).toBeNull()
  })
  it('stays quiet on one passing mention or no company', () => {
    expect(otherCompanyNamed('You will partner with teams at Google on integrations. Responsibilities follow.', 'Acme')).toBeNull()
    expect(otherCompanyNamed(ad, '')).toBeNull()
  })
})
