import { describe, expect, it } from 'vitest'
import { payFromText } from '@/lib/pay'

const label = (t: string) => payFromText(t)?.label ?? null

describe('payFromText', () => {
  it('reads yearly ranges in the common shapes', () => {
    expect(label('The base salary range for this role is $120,000 - $150,000.')).toBe('$120k to $150k a year')
    expect(label('Compensation: $120k–$150k')).toBe('$120k to $150k a year')
    expect(label('Pay range $120 - 150k per year')).toBe('$120k to $150k a year')
    expect(label('USD 95,000 to 110,000 annually')).toBe('$95k to $110k a year')
    expect(label('Salary: 120k-150k')).toBe('$120k to $150k a year')
    expect(label('£45,000 - £55,000 per annum')).toBe('£45k to £55k a year')
    expect(label('$142,500 - $187,500 USD')).toBe('$142.5k to $187.5k a year')
  })

  it('reads hourly pay', () => {
    expect(label('Pay: $22.50 - $28.00 per hour')).toBe('$22.50 to $28 an hour')
    expect(label('Starting at $18/hr')).toBe('$18 an hour')
    expect(label('Hourly rate $45 to $55')).toBe('$45 to $55 an hour')
  })

  it('reads a single yearly figure the ad calls pay', () => {
    expect(label('Salary: $90,000 a year plus equity')).toBe('$90k a year')
  })

  it('ignores money that is not pay', () => {
    expect(label('We raised $50M in Series B funding last year.')).toBeNull()
    expect(label('A $5,000 signing bonus and a $1,500 home office stipend.')).toBeNull()
    expect(label('We have $20 million in ARR and serve 4,000 customers.')).toBeNull()
    expect(label('401k match up to $6,000.')).toBeNull()
    expect(label('We are a fast-growing team of 120 people.')).toBeNull()
    expect(label('')).toBeNull()
    expect(payFromText(null)).toBeNull()
  })

  it('takes the pay range over a funding figure earlier in the ad', () => {
    expect(label('Backed by $40M from top investors. The salary range is $130,000 to $160,000.')).toBe('$130k to $160k a year')
  })

  it('returns the numbers too', () => {
    expect(payFromText('$120,000 - $150,000 per year')).toMatchObject({ min: 120000, max: 150000, period: 'year', currency: '$' })
  })
})

describe('perks are not pay', () => {
  it('skips a budget, stipend or allowance a few words after the amount', () => {
    expect(payFromText('Perks:\n - $100/month education budget with conferences covered')).toBeNull()
    expect(payFromText('We offer a $500 home office stipend.')).toBeNull()
    expect(payFromText('Salary: $170K - $230K\n\nPerks: $100/month education budget')?.label).toBe('$170k to $230k a year')
    expect(payFromText('Salary: $170K - $230K\n\nPerks: free lunch')?.label).toBe('$170k to $230k a year')
    expect(payFromText('Salary: $120,000 - $150,000 plus annual bonus')?.label).toBe('$120k to $150k a year')
    expect(payFromText('Pay: $25/hour + tuition reimbursement')?.label).toBe('$25 an hour')
  })
  it('skips a small monthly figure', () => {
    expect(payFromText('Phone: $50 a month')).toBeNull()
    expect(payFromText('Pay: $4,500 a month')?.label).toBe('$4.5k a month')
  })
})

describe('pay: the surest figure wins, European thousands', () => {
  it('takes the stated hourly range over a perk near a pay word', () => {
    const text =
      '• $300 annual free bedding, plus an employee discount and $250 new hire gift card\nCompensation\nThis is an hourly (non-exempt) role that has a pay range of $22.00- $24.00 per hour dependent on experience'
    expect(payFromText(text)?.label).toBe('$22 to $24 an hour')
  })
  it('reads 102.700 as 102,700, not 102.70', () => {
    expect(payFromText('The annual salary range is €102.700 - €162.500.')).toMatchObject({ min: 102700, max: 162500, period: 'year' })
    expect(payFromText('Pay: $22.50 per hour')).toMatchObject({ min: 22.5, period: 'hour' })
  })
})

describe('pay: retirement match and "hourly"', () => {
  it('skips a 401(k) match amount after the real range', () => {
    const text =
      'United States | Remote - Anticipated Base Salary Range $220,700—$300,000 USD What you\'ll love At Upstart, our benefits include a 401(k) or Group Retirement Savings Plan with a company match of $2 for every $1 contributed, up to $15,000 annually'
    expect(payFromText(text)?.label).toBe('$220.7k to $300k a year')
  })
  it('reads "hourly" as the period, so the range beats a lone starting rate', () => {
    const text = 'Pay Range: $17 - $18 hourly (based on level of experience) • Pay: Starting pay for this position is $17/hr.'
    expect(payFromText(text)?.label).toBe('$17 to $18 an hour')
  })
})

describe('pay: a range after "contribute" still counts', () => {
  it('keeps the salary when the sentence talks about contributing', () => {
    expect(payFromText('You will contribute to our mission, and the base salary range is $120,000 - $150,000')?.label).toBe('$120k to $150k a year')
  })
})

describe('pay: weekly perks', () => {
  it('skips a weekly discount', () => {
    expect(payFromText('What we offer: Enjoy a €30 weekly discount on your boxes. • €10 meal vouchers per day.')).toBeNull()
    expect(payFromText('Pay: $900 weekly')?.label).toBe('$900 a week')
  })
})

describe('pay: period on both ends of a range', () => {
  it('reads "$25.75/hour - $32.19/hour" as one range', () => {
    expect(payFromText('Based in Colorado or Minnesota: $25.75/hour - $32.19/hour.')?.label).toBe('$25.75 to $32.19 an hour')
    expect(payFromText('Pay: $25/hr')?.label).toBe('$25 an hour')
  })
})

describe('pay: a bonus line right after a stated period', () => {
  it('keeps "$20.00 - $31.00 hourly" before "Sign-On Bonus"', () => {
    expect(payFromText('Pay Range: $20.00 - $31.00 hourly Sign-On Bonus of up to $8,000 based on level of experience')?.label).toBe('$20 to $31 an hour')
    expect(payFromText('We offer a $5,000 signing bonus.')).toBeNull()
  })
})
