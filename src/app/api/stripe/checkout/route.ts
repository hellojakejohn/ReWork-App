import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PRICING, isOfferId } from '@/lib/plans'
import { currentChainEnd } from '@/lib/entitlements'
import { subscriptionTrialEnd } from '@/lib/entitlement-rules'
import {
  BLOCKING_SUB_STATUSES,
  appBaseUrl,
  billingUnavailable,
  getStripe,
  safeReturnPath,
} from '@/lib/stripe'

// POST { offer: 'monthly' | 'pass', returnTo?: '/some/path' } -> { url }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { offer?: unknown; returnTo?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!isOfferId(body.offer)) {
    return NextResponse.json({ error: "offer must be 'monthly' or 'pass'" }, { status: 400 })
  }
  const offer = PRICING[body.offer]

  const stripe = getStripe()
  const priceId = process.env[offer.priceEnv]
  if (!stripe || !priceId) return billingUnavailable('Checkout')

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, stripeCustomerId: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // One subscription per user. Check our rows AND Stripe itself, since the webhook
    // for a subscription bought seconds ago may not have landed yet.
    const subRow = await prisma.entitlement.findFirst({
      where: { userId: user.id, source: 'STRIPE_SUBSCRIPTION', status: { in: ['ACTIVE', 'PAST_DUE'] } },
      select: { id: true },
    })
    let hasSubscription = !!subRow
    if (!hasSubscription && user.stripeCustomerId) {
      const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 10 })
      hasSubscription = subs.data.some((s) => BLOCKING_SUB_STATUSES.has(s.status))
    }

    if (hasSubscription) {
      return NextResponse.json(
        offer.id === 'monthly'
          ? {
              error: "You're already on Pro Monthly. Manage it from the billing portal.",
              code: 'already_subscribed',
              portal: true,
            }
          : {
              error:
                "You're on Pro Monthly, which already includes everything in the Job Hunt Pass. If you'd rather pay per pass, cancel the subscription in the billing portal first.",
              code: 'pass_while_subscribed',
              portal: true,
            },
        { status: 409 }
      )
    }

    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email, metadata: { userId: user.id } },
        { idempotencyKey: `customer-create-${user.id}` }
      )
      customerId = customer.id
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } })
    }

    // Buying monthly while a Job Hunt Pass is running: start billing when the pass ends.
    const trialEnd =
      offer.mode === 'subscription'
        ? subscriptionTrialEnd(await currentChainEnd(user.id, 'STRIPE_PASS'), new Date())
        : undefined

    const base = appBaseUrl(request)
    const cancelPath = safeReturnPath(request, body.returnTo, '/pricing')
    const metadata = { userId: user.id, offer: offer.id }

    const checkout = await stripe.checkout.sessions.create({
      mode: offer.mode,
      customer: customerId,
      client_reference_id: user.id,
      metadata,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${base}/dashboard?checkout=success&offer=${offer.id}`,
      cancel_url: `${base}${cancelPath}`,
      ...(offer.mode === 'subscription'
        ? { subscription_data: { metadata, ...(trialEnd ? { trial_end: trialEnd } : {}) } }
        : { payment_intent_data: { metadata } }),
    })

    return NextResponse.json({ url: checkout.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
  }
}
