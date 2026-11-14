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
