// Burn for Pro: burn BURN_PRO_USD of $REWORK, get BURN_PRO_DAYS of Pro (docs/token-plan.md 3b).
//
//   1. quote:  the server prices $15 of $REWORK (lower of Jupiter and DexScreener, with
//              liquidity and fast-move checks), stores a quote event with a random nonce and
//              builds an unsigned transaction: burnChecked + a memo "rework burn <nonce>".
//   2. wallet: Phantom (any wallet-standard Solana wallet) signs and sends it as-is.
//   3. claim:  the server reads the finalized transaction, checks it burned at least the
//              quoted amount of our mint and carries the nonce of a quote on THIS account,
//              then uses the quote up and grants a TOKEN_PAYMENT entitlement in one step.
//
// Jake never holds the tokens. Off unless REWORK_MINT is set, so it ships dark.
// Env: REWORK_MINT, SOLANA_RPC_URL (default: public mainnet), and on devnet or a local
// validator only REWORK_TEST_PRICE_USD (no price feeds there).
import { randomBytes } from 'crypto'
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isLive, passWindow, type EntitlementSource, type EntitlementStatus } from '@/lib/entitlement-rules'
import { refreshPlanMirror, type Access } from '@/lib/entitlements'
import { track } from '@/lib/track'
import { BURN_PRO_DAYS, BURN_PRO_USD } from '@/lib/plans'

export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com'

// tsconfig targets below ES2020, so no 10n literals.
const ZERO = BigInt(0)
const TEN = BigInt(10)

export const MIN_LIQUIDITY_USD = 10_000
export const MAX_SOURCE_GAP = 0.1 // Jupiter and DexScreener may disagree by 10%
export const MAX_MOVE_5M = 0.15 // refuse to quote while the price moved >15% in 5 minutes
export const QUOTE_TTL_MS = 5 * 60_000
export const MAX_QUOTES_PER_HOUR = 20

export class BurnError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'BurnError'
  }
}

export interface BurnConfig {
  mint: string
  rpcUrl: string
  chain: 'solana:mainnet' | 'solana:devnet' | 'solana:localnet'
  testPriceUsd: number | null
}

export function burnConfig(env: Record<string, string | undefined> = process.env): BurnConfig | null {
  const mint = env.REWORK_MINT?.trim()
  if (!mint) return null
  const rpcUrl = env.SOLANA_RPC_URL?.trim() || MAINNET_RPC
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(rpcUrl)
  const devnet = /devnet/i.test(rpcUrl)
  const test = Number(env.REWORK_TEST_PRICE_USD)
  return {
    mint,
    rpcUrl,
    chain: local ? 'solana:localnet' : devnet ? 'solana:devnet' : 'solana:mainnet',
    testPriceUsd: (local || devnet) && Number.isFinite(test) && test > 0 ? test : null,
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function rpc<T = any>(config: BurnConfig, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(config.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body || body.error) {
    console.error(`[token-burn] rpc ${method} failed:`, res.status, body?.error?.message)
    throw new BurnError("Can't reach Solana right now. Try again in a minute.", 503)
  }
  return body.result as T
}

// ---- price ----

export interface DexPair {
  priceUsd?: string
  liquidity?: { usd?: number }
  priceChange?: { m5?: number }
}

/**
 * The price a quote uses: the lower of the two feeds (so a burn never comes in under $15),
 * read off the deepest pool. Refuses thin pools, feeds that disagree, and fast moves, which
 * is what a short pump to burn fewer tokens would look like.
 */
export function pickBurnPrice(jupiterUsd: number | null, pairs: DexPair[]): number {
  const best = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
  const dexUsd = Number(best?.priceUsd)
  if (!jupiterUsd || !(jupiterUsd > 0) || !best || !(dexUsd > 0)) {
    throw new BurnError("We can't get a price for $REWORK right now. Try again in a few minutes.", 503)
  }
  if ((best.liquidity?.usd ?? 0) < MIN_LIQUIDITY_USD) {
    throw new BurnError('The $REWORK pool is too thin to price a burn safely right now. Try again later.', 503)
  }
  if (Math.abs(jupiterUsd - dexUsd) / Math.min(jupiterUsd, dexUsd) > MAX_SOURCE_GAP) {
    throw new BurnError("Price feeds for $REWORK don't agree right now. Try again in a few minutes.", 503)
  }
  if (Math.abs(best.priceChange?.m5 ?? 0) / 100 > MAX_MOVE_5M) {
    throw new BurnError('The $REWORK price is moving fast. Try again in a few minutes.', 503)
  }
  return Math.min(jupiterUsd, dexUsd)
}

async function priceUsd(config: BurnConfig): Promise<number> {
  if (config.testPriceUsd) return config.testPriceUsd
  const get = (url: string) =>
    fetch(url, { signal: AbortSignal.timeout(8_000), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  const [jup, dex] = await Promise.all([
    get(`https://lite-api.jup.ag/price/v3?ids=${config.mint}`),
    get(`https://api.dexscreener.com/tokens/v1/solana/${config.mint}`),
  ])
  return pickBurnPrice(Number(jup?.[config.mint]?.usdPrice) || null, Array.isArray(dex) ? dex : [])
}

/** Raw token units for `usd` at `price`, rounded up to a whole token. */
export function burnAmountRaw(usd: number, price: number, decimals: number): bigint {
  return BigInt(Math.ceil(usd / price)) * TEN ** BigInt(decimals)
}

export function formatTokens(raw: bigint, decimals: number): string {
  return (raw / TEN ** BigInt(decimals)).toLocaleString('en-US')
}

// ---- when burned days start ----

const SUBSCRIPTION_MESSAGE = 'You already have Pro monthly. Burned days would run alongside it, so cancel it first if you want to burn instead.'

/**
 * Burned days start when the user's current Pro ends (pass, comp, earlier burns, or a
 * subscription that's set to cancel), so they're never spent alongside time already paid for.
 * Null for a renewing subscription: there's no end to stack onto.
 */
export async function burnStartsAt(userId: string, now: Date, db: Prisma.TransactionClient = prisma): Promise<Date | null> {
  const rows = (await db.entitlement.findMany({
    where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
    select: { source: true, status: true, startsAt: true, endsAt: true, cancelAtPeriodEnd: true, pastDueAt: true },
  })) as { source: EntitlementSource; status: EntitlementStatus; startsAt: Date; endsAt: Date | null; cancelAtPeriodEnd: boolean; pastDueAt: Date | null }[]
  let start = now.getTime()
  for (const row of rows) {
    if (!isLive(row, now) && row.startsAt.getTime() <= now.getTime()) continue
    if (row.source === 'STRIPE_SUBSCRIPTION' && !row.cancelAtPeriodEnd) return null
    if (!row.endsAt) return null // open-ended comp
    start = Math.max(start, row.endsAt.getTime())
  }
  return new Date(start)
}

// ---- quote + transaction ----

export function burnCheckedInstruction(opts: {
  program: string
  source: string
  mint: string
  owner: string
  amount: bigint
  decimals: number
}): TransactionInstruction {
  const data = Buffer.alloc(10)
  data.writeUInt8(15, 0) // BurnChecked, same index in Token and Token-2022
  data.writeBigUInt64LE(opts.amount, 1)
  data.writeUInt8(opts.decimals, 9)
  return new TransactionInstruction({
    programId: new PublicKey(opts.program),
    keys: [
      { pubkey: new PublicKey(opts.source), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(opts.mint), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(opts.owner), isSigner: true, isWritable: false },
    ],
    data,
  })
}

export const memoText = (nonce: string) => `rework burn ${nonce}`
const MEMO_RE = /^rework burn ([A-Za-z0-9_-]{22})$/

function parseWallet(wallet: unknown): PublicKey {
  try {
    if (typeof wallet !== 'string' || wallet.length > 64) throw new Error()
    return new PublicKey(wallet)
  } catch {
    throw new BurnError("That doesn't look like a Solana wallet address.")
  }
}

export interface BurnQuote {
  tokens: string // whole tokens, formatted
  usd: number
  days: number
  expiresAt: string
  transaction: string // base64, unsigned
  chain: BurnConfig['chain']
}

export async function createBurnQuote(userId: string, walletAddress: unknown, now = new Date()): Promise<BurnQuote> {
  const config = burnConfig()
  if (!config) throw new BurnError('Burn for Pro is not live yet.', 404)
  const owner = parseWallet(walletAddress)
  if (!(await burnStartsAt(userId, now))) throw new BurnError(SUBSCRIPTION_MESSAGE, 409)

  const recent = await prisma.event.count({
    where: { userId, name: 'token_burn_quote', createdAt: { gte: new Date(now.getTime() - 60 * 60_000) } },
  })
  if (recent >= MAX_QUOTES_PER_HOUR) throw new BurnError('Too many quotes in the last hour. Try again later.', 429)

  const mintInfo = await rpc(config, 'getAccountInfo', [config.mint, { encoding: 'jsonParsed', commitment: 'confirmed' }])
  const program = mintInfo?.value?.owner
  const decimals = mintInfo?.value?.data?.parsed?.info?.decimals
  if ((program !== TOKEN_PROGRAM && program !== TOKEN_2022_PROGRAM) || typeof decimals !== 'number') {
    console.error('[token-burn] REWORK_MINT is not a token mint on this cluster')
    throw new BurnError('Burn for Pro is not available right now.', 503)
  }

  const price = await priceUsd(config)
  const amount = burnAmountRaw(BURN_PRO_USD, price, decimals)

  const accounts = await rpc(config, 'getTokenAccountsByOwner', [
    owner.toBase58(),
    { mint: config.mint },
    { encoding: 'jsonParsed', commitment: 'confirmed' },
  ])
  const held = (accounts?.value ?? []).map((a: any) => ({
    pubkey: a.pubkey as string,
    amount: BigInt(a.account?.data?.parsed?.info?.tokenAmount?.amount ?? '0'),
  }))
  const source = held.sort((a: { amount: bigint }, b: { amount: bigint }) => (b.amount > a.amount ? 1 : -1))[0]
  if (!source || source.amount < amount) {
    const have = source ? formatTokens(source.amount, decimals) : '0'
    throw new BurnError(`This wallet holds ${have} $REWORK. 30 days of Pro takes ${formatTokens(amount, decimals)}.`)
  }

  const { value: block } = await rpc(config, 'getLatestBlockhash', [{ commitment: 'finalized' }])
  const nonce = randomBytes(16).toString('base64url')
  const tx = new Transaction({ feePayer: owner, blockhash: block.blockhash, lastValidBlockHeight: block.lastValidBlockHeight })
  tx.add(burnCheckedInstruction({ program, source: source.pubkey, mint: config.mint, owner: owner.toBase58(), amount, decimals }))
  tx.add(
    new TransactionInstruction({
      programId: new PublicKey(MEMO_PROGRAM),
      keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
      data: Buffer.from(memoText(nonce), 'utf8'),
    })
  )

  const expiresAt = new Date(now.getTime() + QUOTE_TTL_MS)
  // No wallet address in the event: the nonce alone ties the burn to this account.
  await prisma.event.create({
    data: {
      name: 'token_burn_quote',
      userId,
      props: { nonce, amountRaw: amount.toString(), decimals, priceUsd: price, expiresAt: expiresAt.toISOString() },
    },
  })

  return {
    tokens: formatTokens(amount, decimals),
    usd: BURN_PRO_USD,
    days: BURN_PRO_DAYS,
    expiresAt: expiresAt.toISOString(),
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'),
    chain: config.chain,
  }
}

// ---- claim ----

/** What a finalized transaction burned of `mint` and the nonce its memo carries. Pure. */
export function readBurn(tx: any, mint: string): { burned: bigint; nonce: string | null } {
  if (!tx || tx.meta?.err) return { burned: ZERO, nonce: null }
  let burned = ZERO
  let nonce: string | null = null
  for (const ix of tx.transaction?.message?.instructions ?? []) {
    const programId = String(ix.programId ?? '')
    if ((programId === TOKEN_PROGRAM || programId === TOKEN_2022_PROGRAM) && ix.parsed?.info?.mint === mint) {
      if (ix.parsed.type === 'burnChecked') burned += BigInt(ix.parsed.info.tokenAmount?.amount ?? '0')
      else if (ix.parsed.type === 'burn') burned += BigInt(ix.parsed.info.amount ?? '0')
    }
    if (programId === MEMO_PROGRAM && typeof ix.parsed === 'string') {
      const match = MEMO_RE.exec(ix.parsed.trim())
      if (match) nonce = match[1]
    }
  }
  return { burned, nonce }
}

export type ClaimResult = { status: 'pending' } | { status: 'granted'; access: Access; alreadyClaimed: boolean }

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/

export async function claimBurn(userId: string, signature: unknown, now = new Date()): Promise<ClaimResult> {
  const config = burnConfig()
  if (!config) throw new BurnError('Burn for Pro is not live yet.', 404)
  if (typeof signature !== 'string' || !SIGNATURE_RE.test(signature.trim())) {
    throw new BurnError("That doesn't look like a Solana transaction signature.")
  }
  const sig = signature.trim()

  const existing = await prisma.entitlement.findUnique({
    where: { source_externalId: { source: 'TOKEN_PAYMENT', externalId: sig } },
    select: { userId: true },
  })
  if (existing) {
    if (existing.userId !== userId) throw new BurnError('That burn was already used on another account.', 409)
    return { status: 'granted', access: await refreshPlanMirror(userId), alreadyClaimed: true }
  }

  const tx = await rpc(config, 'getTransaction', [sig, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }])
  if (!tx) return { status: 'pending' }
  if (tx.meta?.err) throw new BurnError('That transaction failed on Solana, so nothing was burned.')

  const { burned, nonce } = readBurn(tx, config.mint)
  if (burned === ZERO) throw new BurnError("That transaction didn't burn any $REWORK.")
  if (!nonce) throw new BurnError("That burn didn't come from a rework quote, so it can't be matched to your account.")

  const quote = await prisma.event.findFirst({
    where: { userId, name: 'token_burn_quote', props: { path: ['nonce'], equals: nonce } },
    select: { id: true, props: true },
  })
  if (!quote) throw new BurnError("That burn's quote belongs to a different account or was already used.", 409)
  const props = quote.props as { amountRaw?: string; priceUsd?: number }
  if (burned < BigInt(props.amountRaw ?? '0')) throw new BurnError('That burn is smaller than the quote it was made from.')

  try {
    await prisma.$transaction(async (db) => {
      // Using the quote up is what stops one quote buying Pro twice.
      const used = await db.event.deleteMany({ where: { id: quote.id } })
      if (used.count !== 1) throw new BurnError('That quote was already used.', 409)
      // The tokens are already gone, so grant even if a subscription started since the quote.
      const window = passWindow(now, (await burnStartsAt(userId, now, db)) ?? now, BURN_PRO_DAYS)
      await db.entitlement.create({
        data: { userId, source: 'TOKEN_PAYMENT', status: 'ACTIVE', startsAt: window.startsAt, endsAt: window.endsAt, externalId: sig },
      })
    })
  } catch (error) {
    // Two tabs claiming the same signature at once: the loser lands here.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return claimBurn(userId, sig, now)
    }
    throw error
  }

  await track('token_burn', { usd: BURN_PRO_USD, days: BURN_PRO_DAYS, priceUsd: props.priceUsd ?? null }, userId)
  return { status: 'granted', access: await refreshPlanMirror(userId), alreadyClaimed: false }
}
