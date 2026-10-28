// Burn for Pro: the pure parts (price checks, amounts, reading a finalized transaction, config).
// The on-chain flow is covered by token-burn-localnet.test.ts.
import { describe, expect, it } from 'vitest'
import { MEMO_PROGRAM, TOKEN_PROGRAM, burnAmountRaw, burnConfig, burnStartsAt, pickBurnPrice, readBurn } from '@/lib/token-burn'

const MINT = 'AwSsrG1abbDUVyywF7QpQkq4RPSJLHqML3494c3JxEf'
const pair = (priceUsd: string, liquidity = 50_000, m5 = 1) => ({ priceUsd, liquidity: { usd: liquidity }, priceChange: { m5 } })

describe('pickBurnPrice', () => {
  it('uses the lower feed, read off the deepest pool', () => {
    expect(pickBurnPrice(0.0011, [pair('0.002', 5_000), pair('0.00105', 80_000)])).toBe(0.00105)
    expect(pickBurnPrice(0.001, [pair('0.00105')])).toBe(0.001)
  })
  it('refuses missing prices, thin pools, disagreeing feeds and fast moves', () => {
    expect(() => pickBurnPrice(null, [pair('0.001')])).toThrow(/can't get a price/)
    expect(() => pickBurnPrice(0.001, [])).toThrow(/can't get a price/)
    expect(() => pickBurnPrice(0.001, [pair('0.001', 9_999)])).toThrow(/too thin/)
    expect(() => pickBurnPrice(0.001, [pair('0.0012')])).toThrow(/don't agree/)
    expect(() => pickBurnPrice(0.001, [pair('0.001', 50_000, -16)])).toThrow(/moving fast/)
  })
})

describe('burnAmountRaw', () => {
  it('rounds up to a whole token, so a burn is never under $15', () => {
    expect(burnAmountRaw(15, 0.001, 6)).toBe(BigInt(15_000) * BigInt(1_000_000))
    expect(burnAmountRaw(15, 0.0007, 6)).toBe(BigInt(21_429) * BigInt(1_000_000))
    expect(burnAmountRaw(15, 0.000003, 9)).toBe(BigInt(5_000_000) * BigInt(10) ** BigInt(9))
  })
})

describe('readBurn', () => {
  const burn = (mint: string, amount: string) => ({ programId: TOKEN_PROGRAM, parsed: { type: 'burnChecked', info: { mint, tokenAmount: { amount } } } })
  const memo = (text: string) => ({ programId: MEMO_PROGRAM, parsed: text })
  const tx = (...instructions: unknown[]) => ({ meta: { err: null }, transaction: { message: { instructions } } })
  const nonce = 'abcdefghijklmnopqrstuv'

  it('reads the burned amount of our mint and the memo nonce', () => {
    expect(readBurn(tx(burn(MINT, '15000000000'), memo(`rework burn ${nonce}`)), MINT)).toEqual({ burned: BigInt(15_000_000_000), nonce })
  })
  it('ignores other mints, failed transactions and memos in another shape', () => {
    expect(readBurn(tx(burn('Other111111111111111111111111111111111111111', '99'), memo(`rework burn ${nonce}`)), MINT).burned).toBe(BigInt(0))
    expect(readBurn({ ...tx(burn(MINT, '5')), meta: { err: { InstructionError: [0, 'x'] } } }, MINT).burned).toBe(BigInt(0))
    expect(readBurn(tx(burn(MINT, '5'), memo(`rework burn ${nonce} extra`)), MINT).nonce).toBeNull()
    expect(readBurn(null, MINT)).toEqual({ burned: BigInt(0), nonce: null })
  })
})

describe('burnConfig', () => {
  it('is off without a mint, and only honors a test price off mainnet', () => {
    expect(burnConfig({})).toBeNull()
    expect(burnConfig({ REWORK_MINT: MINT, REWORK_TEST_PRICE_USD: '1' })).toMatchObject({ chain: 'solana:mainnet', testPriceUsd: null })
    expect(burnConfig({ REWORK_MINT: MINT, SOLANA_RPC_URL: 'https://api.devnet.solana.com', REWORK_TEST_PRICE_USD: '1' })).toMatchObject({ chain: 'solana:devnet', testPriceUsd: 1 })
    expect(burnConfig({ REWORK_MINT: MINT, SOLANA_RPC_URL: 'http://127.0.0.1:8899', REWORK_TEST_PRICE_USD: '1' })).toMatchObject({ chain: 'solana:localnet', testPriceUsd: 1 })
    expect(burnConfig({ REWORK_MINT: MINT, SOLANA_RPC_URL: 'https://localhost.evil.com', REWORK_TEST_PRICE_USD: '1' })).toMatchObject({ testPriceUsd: null })
  })
})

describe('burnStartsAt', () => {
  const now = new Date('2026-11-10T00:00:00Z')
  const day = 86_400_000
  const row = (source: string, endsInDays: number | null, extra = {}) => ({
    source,
    status: 'ACTIVE',
    startsAt: new Date(now.getTime() - day),
    endsAt: endsInDays === null ? null : new Date(now.getTime() + endsInDays * day),
    cancelAtPeriodEnd: false,
    pastDueAt: null,
    ...extra,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbWith = (rows: unknown[]) => ({ entitlement: { findMany: async () => rows } }) as any

  it('starts now with no Pro, after a pass, after a stacked pass that has not started yet', async () => {
    expect(await burnStartsAt('u', now, dbWith([]))).toEqual(now)
    expect(await burnStartsAt('u', now, dbWith([row('STRIPE_PASS', 20)]))).toEqual(new Date(now.getTime() + 20 * day))
    const later = { ...row('STRIPE_PASS', 110), startsAt: new Date(now.getTime() + 20 * day) }
    expect(await burnStartsAt('u', now, dbWith([row('STRIPE_PASS', 20), later]))).toEqual(new Date(now.getTime() + 110 * day))
  })
  it('stacks after a canceling subscription, refuses a renewing one or an open-ended comp', async () => {
    expect(await burnStartsAt('u', now, dbWith([row('STRIPE_SUBSCRIPTION', 5, { cancelAtPeriodEnd: true })]))).toEqual(new Date(now.getTime() + 5 * day))
    expect(await burnStartsAt('u', now, dbWith([row('STRIPE_SUBSCRIPTION', 5)]))).toBeNull()
    expect(await burnStartsAt('u', now, dbWith([row('COMP', null)]))).toBeNull()
  })
  it('ignores rows that already ran out', async () => {
    expect(await burnStartsAt('u', now, dbWith([row('STRIPE_PASS', -2)]))).toEqual(now)
  })
})
