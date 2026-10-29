import { describe, expect, it } from 'vitest'
import { cleanJobTitle, otherCompanyNamed, sameCompany, scamSignals } from '@/lib/job-checks'

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

describe('scamSignals', () => {
  const ids = (text: string) => scamSignals(text).map((s) => s.id)

  it('flags the fake take-home test', () => {
    expect(ids('For the technical assessment, clone our repo from github.com/acme-labs/trade-bot and run npm install before the call.')).toEqual(['run_code'])
    expect(ids('Download the project files (.zip) and run it locally as your test task.')).toContain('run_code')
  })
  it('flags chat-app contact', () => {
    expect(ids('Interested? Contact our HR manager on Telegram @hr_jobs_desk to schedule your interview.')).toContain('chat_app')
    expect(ids('Apply here: https://t.me/acmehiring')).toContain('chat_app')
    expect(ids('WhatsApp +1 (555) 201-3344 for details.')).toContain('chat_app')
  })
  it('flags paying to start and check scams', () => {
    expect(ids('There is a refundable training fee of $49.')).toContain('pay_to_start')
    expect(ids('You will purchase your equipment from our approved vendor.')).toContain('pay_to_start')
    expect(ids('We will send you a check to buy supplies. Deposit the check and wire the rest.')).toContain('pay_to_start')
  })
  it('flags wallet and key requests', () => {
    expect(ids('To verify your identity, connect your wallet on our portal.')).toContain('wallet')
    expect(ids('Send 50 USDT to activate your account.')).toContain('wallet')
    expect(ids('Never share anything except your seed phrase with our support team.')).toContain('wallet')
  })
  it('flags asking for ID and bank details up front', () => {
    expect(ids('Please send a copy of your ID and your bank account details to get started.')).toContain('personal_info')
    expect(ids('Email your resume and SSN to apply.')).toContain('personal_info')
  })
  it('flags a personal email contact', () => {
    expect(ids('Send your resume to acme.careers2026@gmail.com.')).toEqual(['personal_email'])
  })

  it('leaves normal ads alone', () => {
    const swe = `We're hiring a Senior Backend Engineer.
- 5+ years with Go, Postgres and GitHub Actions
- You will own and run our deploy pipeline and maintain several repositories
- Interview process: recruiter call, a 60 minute live coding interview, then a team chat
We pay for training and conferences. There are no fees to apply.
Apply at careers.acme.com.`
    expect(ids(swe)).toEqual([])
    const crypto = `Join our wallet team as a Security Engineer. You'll design how users manage private keys and recovery phrases safely.
Experience with Ethereum and Solidity required. We build Telegram mini apps for 10M users.`
    expect(ids(crypto)).toEqual([])
    const ops = 'Coordinate vendor schedules, track invoices and support budget tracking. Excel or Google Sheets required.'
    expect(ids(ops)).toEqual([])
  })

  it('quotes the sentence that matched, trimmed', () => {
    const [s] = scamSignals(`Great pay. ${'Very '.repeat(40)}long: send 10 USDT to start.`)
    expect(s.id).toBe('wallet')
    expect(s.quote.length).toBeLessThanOrEqual(160)
  })
})
