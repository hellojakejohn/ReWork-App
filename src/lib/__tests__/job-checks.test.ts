import { describe, expect, it } from 'vitest'
import { cleanJobTitle, ghostSignals, mentionsPay, otherCompanyNamed, postedDaysAgo, sameCompany, scamSignals } from '@/lib/job-checks'

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

describe('ghostSignals', () => {
  const now = new Date('2026-10-29T12:00:00Z')
  const plain = 'Build payment flows for merchants. You will own the checkout API and work with design. '.repeat(4)
  const paid = `${plain}\nThe base salary range is $140,000 - $170,000 per year.`
  const ids = (description: string, facts = {}) => ghostSignals(description, facts, now).map((s) => s.id)

  it('is quiet for a fresh ad with pay', () => {
    expect(ids(paid, { posted: '2026-10-20' })).toEqual([])
    expect(ids(paid, { posted: '3 days ago', applicants: '42 applicants' })).toEqual([])
  })
  it('flags an old or reposted ad', () => {
    expect(ids(paid, { posted: '2026-08-01' })).toEqual(['old'])
    expect(ghostSignals(paid, { posted: '2026-08-01' }, now)[0].label).toMatch(/^Posted about 3 months ago/)
    expect(ids(paid, { posted: 'Reposted 2 weeks ago' })).toEqual(['reposted'])
    expect(ids(paid, { posted: 'Reposted 1 month ago' })).toEqual(['old', 'reposted'])
    expect(ghostSignals(paid, { posted: '30+ days ago' }, now)[0].label).toMatch(/^Posted 30\+ days ago/)
  })
  it('flags a closed posting', () => {
    expect(ids(paid, { closes: '2026-10-01' })).toEqual(['closed'])
    expect(ids(paid, { closes: '2026-12-01' })).toEqual([])
  })
  it('flags no pay, but not when a structured field has it or the text is short', () => {
    expect(ids(plain)).toEqual(['no_pay'])
    expect(ids(plain, { pay: true })).toEqual([])
    expect(ids('Barista wanted, mornings, downtown. Apply in person.')).toEqual([])
  })
  it('reads pay written many ways', () => {
    for (const pay of ['$22/hr', 'USD 90,000', '120k - 150k', '25.50 per hour', 'Salary: 65,000 a year', '£45,000', '90,000 EUR']) {
      expect(mentionsPay(`${plain} ${pay}`), pay).toBe(true)
    }
    expect(mentionsPay(`${plain} We offer a 401(k) match and 20 days off.`)).toBe(false)
  })
  it('flags agency and future-openings ads with what matched', () => {
    const agency = ghostSignals(`Our client, a fast-growing fintech, is hiring. ${paid}`, {}, now)
    expect(agency.map((s) => s.id)).toEqual(['agency'])
    expect(agency[0].label).toContain('"our client"')
    expect(ids(`We are hiring for our client in Denver. ${paid}`)).toEqual(['agency'])
    expect(ids(`Acme Staffing is recruiting on behalf of a client. ${paid}`)).toEqual(['agency'])
    expect(ids(`Join our talent community and be considered for future openings. ${paid}`)).toEqual(['pipeline'])
    expect(ids(`This role may not be immediately available; we are building our pipeline of exceptional talent. ${paid}`)).toEqual(['pipeline'])
  })
  it('ignores the same words in normal ads', () => {
    expect(ids(`Join our Client Platform team. We serve our clients well. ${paid}`)).toEqual([])
    expect(ids(`We work with the broadest talent pool possible. Build a pipeline of enterprise accounts. Own evergreen campaigns. ${paid}`)).toEqual([])
  })
  it('flags a big applicant pile', () => {
    expect(ids(paid, { applicants: 'Over 100 applicants' })).toEqual(['applicants'])
    expect(ids(paid, { applicants: '1,204 people clicked apply' })).toEqual(['applicants'])
  })
})

describe('postedDaysAgo', () => {
  const now = new Date('2026-10-29T12:00:00Z')
  it('reads dates and board phrases', () => {
    expect(postedDaysAgo('2026-10-19T08:00:00Z', now)).toEqual({ days: 10, plus: false })
    expect(postedDaysAgo('Posted 3 weeks ago', now)).toEqual({ days: 21, plus: false })
    expect(postedDaysAgo('an hour ago', now)).toEqual({ days: 0, plus: false })
    expect(postedDaysAgo('Just posted', now)).toEqual({ days: 0, plus: false })
    expect(postedDaysAgo('30+ days ago', now)).toEqual({ days: 30, plus: true })
    expect(postedDaysAgo('Saint Paul, MN', now)).toBeNull()
    expect(postedDaysAgo(undefined, now)).toBeNull()
  })
})
