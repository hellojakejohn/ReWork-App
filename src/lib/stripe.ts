// Lazy Stripe client. Nothing here runs at import, so `next build` works with no env set.
import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import type { Offer } from '@/lib/plans'

let client: Stripe | null = null

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  client ??= new Stripe(key, { apiVersion: STRIPE_API_VERSION })
  return client
}

export function billingUnavailable(what = 'Billing') {
  return NextResponse.json(
    { error: `${what} is not configured yet. Please try again later.` },
    { status: 503 }
  )
}

/** Absolute base URL for redirects back into the app. */
export function appBaseUrl(request: Request): string {
  const configured = process.env.NEXTAUTH_URL?.replace(/\/$/, '')
  return configured || new URL(request.url).origin
}

/**
 * Relative in-app path to send the user back to. Accepts an explicit path or falls back to
 * the Referer when it's same-origin. Never returns an absolute or protocol-relative URL.
 */
export function safeReturnPath(request: Request, candidate: unknown, fallback: string): string {
  const isSafe = (p: string) => p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/\\')
  if (typeof candidate === 'string' && isSafe(candidate)) return candidate
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const ref = new URL(referer)
      if (ref.origin === new URL(request.url).origin || ref.origin === process.env.NEXTAUTH_URL?.replace(/\/$/, '')) {
        const path = ref.pathname + ref.search
        if (isSafe(path)) return path
      }
    } catch {
      // bad referer, use fallback
    }
  }
  return fallback
}

/**
 * Period end moved from the subscription to its items in newer API versions.
 * Read the item first and fall back to the old field.
 */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const itemEnd = sub.items?.data?.[0]?.current_period_end
  const legacyEnd = (sub as unknown as { current_period_end?: number }).current_period_end
  const secs = itemEnd ?? legacyEnd
  return typeof secs === 'number' ? new Date(secs * 1000) : null
}

/** The key's mode. Webhook events and prices from the other mode are ignored or flagged. */
export function stripeKeyIsLive(): boolean {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || '')
}

/** Stripe's "No such customer" (and friends): the stored id is from the other mode or was deleted. */
export function isMissingResource(error: unknown): boolean {
  const e = error as { code?: string; raw?: { code?: string } } | null
  return e?.code === 'resource_missing' || e?.raw?.code === 'resource_missing'
}

export function stripeId(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

/** Stripe statuses that mean the customer already has a subscription we shouldn't duplicate. */
export const BLOCKING_SUB_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid'])

/** The Stripe price id for an offer, from its env var. No fallbacks: a missing id disables that offer. */
export function stripePriceId(offer: Offer): string | null {
  return process.env[offer.priceEnv]?.trim() || null
}

/** Is this Stripe price the one configured for the offer? Grants are only made for these. */
export function isConfiguredPrice(offer: Offer, priceId: string | null | undefined): boolean {
  const configured = stripePriceId(offer)
  return !!configured && !!priceId && priceId === configured
}

export interface PriceCheck {
  ok: boolean
  priceId: string | null
  expectedUsd: number
  detail: string
}

/**
 * Fetches the configured price for each offer and checks it against plans.ts: USD, the
 * same amount, and recurring monthly for a subscription / one-time for a payment.
 */
export async function checkStripePrices(stripe: Stripe, offers: Offer[]): Promise<Record<string, PriceCheck>> {
  const out: Record<string, PriceCheck> = {}
  for (const offer of offers) {
    const priceId = stripePriceId(offer)
    const base = { priceId, expectedUsd: offer.priceUsd }
    if (!priceId) {
      out[offer.id] = { ...base, ok: false, detail: `${offer.priceEnv} is not set` }
      continue
    }
    try {
      const price = await stripe.prices.retrieve(priceId)
      const problems: string[] = []
      if (price.currency !== 'usd') problems.push(`currency ${price.currency}`)
      if (price.unit_amount !== Math.round(offer.priceUsd * 100)) problems.push(`unit_amount ${price.unit_amount} (expected ${Math.round(offer.priceUsd * 100)})`)
      if (offer.mode === 'subscription' && price.recurring?.interval !== 'month') problems.push('not a monthly recurring price')
      if (offer.mode === 'payment' && price.type !== 'one_time') problems.push('not a one-time price')
      if (!price.active) problems.push('price is archived')
      if (price.livemode !== stripeKeyIsLive()) problems.push(`price is ${price.livemode ? 'live' : 'test'} mode but the key is ${stripeKeyIsLive() ? 'live' : 'test'}`)
      out[offer.id] = { ...base, ok: problems.length === 0, detail: problems.length ? problems.join('; ') : 'matches plans.ts' }
    } catch (error) {
      out[offer.id] = { ...base, ok: false, detail: String((error as Error)?.message || error).slice(0, 200) }
    }
  }
  return out
}

/** Every event the webhook handles. Enable exactly these on the Stripe endpoint. */
export const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'customer.deleted',
] as const

export const STRIPE_API_VERSION = '2026-02-25.clover'

/**
 * Finds the webhook endpoint for this deployment and checks it is enabled, sends every
 * event we handle, and renders payloads in the same API version the SDK is pinned to.
 */
export async function checkStripeWebhook(stripe: Stripe, baseUrl: string): Promise<{ ok: boolean; detail: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/stripe/webhook`
  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
    const endpoint = endpoints.data.find((e) => e.url === url)
    if (!endpoint) return { ok: false, detail: `no webhook endpoint for ${url}` }
    const problems: string[] = []
    if (endpoint.status !== 'enabled') problems.push(`status ${endpoint.status}`)
    const enabled = new Set(endpoint.enabled_events)
    const missing = enabled.has('*') ? [] : WEBHOOK_EVENTS.filter((e) => !enabled.has(e))
    if (missing.length) problems.push(`missing events: ${missing.join(', ')}`)
    if (endpoint.api_version && endpoint.api_version !== STRIPE_API_VERSION) {
      problems.push(`endpoint API version ${endpoint.api_version}, SDK pinned to ${STRIPE_API_VERSION}`)
    }
    if (endpoint.livemode !== stripeKeyIsLive()) problems.push('endpoint mode does not match the key')
    return { ok: problems.length === 0, detail: problems.length ? problems.join('; ') : `${url} ok` }
  } catch (error) {
    return { ok: false, detail: String((error as Error)?.message || error).slice(0, 200) }
  }
}
