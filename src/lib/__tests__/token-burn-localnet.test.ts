// Burn for Pro end to end against a local Solana validator, with the database in memory.
// Skipped unless LOCALNET_FILE points at a setup file ({ holder: secretKey[], classic, t22 }
// mint addresses, 6 decimals, 1M tokens held). To run:
//   solana-test-validator --reset   then create the mints, then
//   LOCALNET_FILE=/path/localnet.json npx vitest run src/lib/__tests__/token-burn-localnet.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Connection, Keypair, Transaction } from '@solana/web3.js'

const db = vi.hoisted(() => ({ events: [] as any[], entitlements: [] as any[], n: 0 }))

vi.mock('@/lib/prisma', () => {
  const event = {
    count: vi.fn(async ({ where }: any) => db.events.filter((e) => e.userId === where.userId && e.name === where.name).length),
    create: vi.fn(async ({ data }: any) => {
      const row = { id: `e${++db.n}`, createdAt: new Date(), ...data }
      db.events.push(row)
      return row
    }),
    findFirst: vi.fn(
      async ({ where }: any) =>
        db.events.find((e) => e.userId === where.userId && e.name === where.name && e.props?.[where.props.path[0]] === where.props.equals) ?? null
    ),
    deleteMany: vi.fn(async ({ where }: any) => {
      const before = db.events.length
      db.events = db.events.filter((e) => e.id !== where.id)
      return { count: before - db.events.length }
    }),
  }
  const entitlement = {
    findUnique: vi.fn(
      async ({ where }: any) =>
        db.entitlements.find((e) => e.source === where.source_externalId.source && e.externalId === where.source_externalId.externalId) ?? null
    ),
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async ({ where }: any) => db.entitlements.filter((e) => e.userId === where.userId)),
    create: vi.fn(async ({ data }: any) => {
      if (db.entitlements.some((e) => e.source === data.source && e.externalId === data.externalId)) {
        const { Prisma } = await import('@prisma/client')
        throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' })
      }
      const row = { id: `n${++db.n}`, cancelAtPeriodEnd: false, pastDueAt: null, ...data }
      db.entitlements.push(row)
      return row
    }),
  }
  const prisma: any = { event, entitlement, user: { update: vi.fn(async () => ({})) } }
  prisma.$transaction = async (fn: any) => fn(prisma)
  return { prisma }
})

import { claimBurn, createBurnQuote, BurnError } from '@/lib/token-burn'

const file = process.env.LOCALNET_FILE
const setup = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
const RPC = 'http://127.0.0.1:8899'

async function signAndSend(base64: string, holder: Keypair): Promise<string> {
  const tx = Transaction.from(Buffer.from(base64, 'base64'))
  tx.partialSign(holder) // what the wallet does
  const conn = new Connection(RPC, 'confirmed')
  const sig = await conn.sendRawTransaction(tx.serialize())
  await conn.confirmTransaction(sig, 'confirmed')
  return sig
}

async function claimWhenFinal(userId: string, sig: string) {
  for (let i = 0; i < 60; i++) {
    const result = await claimBurn(userId, sig)
    if (result.status !== 'pending') return result
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('never finalized')
}

describe.skipIf(!setup).each(['classic', 't22'])('burn for Pro on a local validator (%s mint)', (kind) => {
  beforeEach(() => {
    db.events = []
    db.entitlements = []
    process.env.REWORK_MINT = setup[kind]
    process.env.SOLANA_RPC_URL = RPC
    process.env.REWORK_TEST_PRICE_USD = '0.001' // $15 = 15,000 tokens
  })

  it('quotes, burns, grants 30 days once, and refuses replays', async () => {
    const holder = Keypair.fromSecretKey(Uint8Array.from(setup.holder))
    const conn = new Connection(RPC, 'confirmed')
    const balance = async () => {
      const { value } = await conn.getParsedTokenAccountsByOwner(holder.publicKey, { mint: new (await import('@solana/web3.js')).PublicKey(setup[kind]) })
      return BigInt(value[0].account.data.parsed.info.tokenAmount.amount)
    }
    const before = await balance()

    const quote = await createBurnQuote('u1', holder.publicKey.toBase58())
    expect(quote).toMatchObject({ tokens: '15,000', usd: 15, days: 30, chain: 'solana:localnet' })

    const sig = await signAndSend(quote.transaction, holder)
    const result = await claimWhenFinal('u1', sig)
    expect(result).toMatchObject({ status: 'granted', alreadyClaimed: false })
    expect(before - (await balance())).toBe(BigInt(15_000) * BigInt(1_000_000))

    const row = db.entitlements[0]
    expect(row).toMatchObject({ userId: 'u1', source: 'TOKEN_PAYMENT', status: 'ACTIVE', externalId: sig })
    expect(Math.round((row.endsAt - row.startsAt) / 86_400_000)).toBe(30)
    expect(db.events.some((e) => e.name === 'token_burn_quote')).toBe(false) // used up
    expect(db.events.some((e) => e.name === 'token_burn')).toBe(true)

    // Same user again: idempotent. Another user: refused.
    expect(await claimBurn('u1', sig)).toMatchObject({ status: 'granted', alreadyClaimed: true })
    await expect(claimBurn('u2', sig)).rejects.toThrow(/another account/)
    expect(db.entitlements).toHaveLength(1)
  }, 90_000)

  it("another account can't claim a burn made from my quote", async () => {
    const holder = Keypair.fromSecretKey(Uint8Array.from(setup.holder))
    const quote = await createBurnQuote('u1', holder.publicKey.toBase58())
    const sig = await signAndSend(quote.transaction, holder)
    let error: unknown
    for (let i = 0; i < 60 && !error; i++) {
      try {
        if ((await claimBurn('u2', sig)).status === 'pending') await new Promise((r) => setTimeout(r, 1000))
      } catch (e) {
        error = e
      }
    }
    expect(error).toBeInstanceOf(BurnError)
    expect((error as Error).message).toMatch(/different account/)
    expect(db.entitlements).toHaveLength(0)
    // The rightful owner still can.
    expect(await claimWhenFinal('u1', sig)).toMatchObject({ status: 'granted' })
  }, 90_000)

  it('refuses a wallet that holds too little', async () => {
    const empty = Keypair.generate()
    await expect(createBurnQuote('u1', empty.publicKey.toBase58())).rejects.toThrow(/holds 0 \$REWORK/)
  })
})
