// Lazy Stripe client. Nothing here runs at import, so `next build` works with no env set.
import Stripe from 'stripe'
import { NextResponse } from 'next/server'

let client: Stripe | null = null

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  client ??= new Stripe(key, { apiVersion: '2026-02-25.clover' })
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

export function stripeId(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

/** Stripe statuses that mean the customer already has a subscription we shouldn't duplicate. */
export const BLOCKING_SUB_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid'])
