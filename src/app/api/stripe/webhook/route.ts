import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getStripe, stripeId, stripeKeyIsLive } from '@/lib/stripe'
import {
  forgetCustomer,
  grantPassFromCheckout,
  invoiceSubscriptionId,
  refundPassFromCharge,
  revokePassForDispute,
  syncSubscription,
} from '@/lib/stripe-sync'
import { track } from '@/lib/track'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Events to enable on the Stripe webhook endpoint: WEBHOOK_EVENTS in src/lib/stripe.ts
// (/api/health checks the live endpoint against it).

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const body = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Signing secrets are per mode, so this only trips on a misconfigured endpoint.
  if (event.livemode !== stripeKeyIsLive()) {
    console.warn(`[stripe] ignoring ${event.livemode ? 'live' : 'test'} event ${event.id} with a ${stripeKeyIsLive() ? 'live' : 'test'} key`)
    return NextResponse.json({ received: true, ignored: 'mode mismatch' })
  }

  const seen = await prisma.stripeEvent.findUnique({ where: { id: event.id }, select: { id: true } })
  if (seen) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    await handleEvent(stripe, event)
  } catch (error) {
    // 500 makes Stripe retry. Handlers are idempotent, so a partial run is safe to repeat.
    console.error(`Error processing webhook ${event.type} ${event.id}:`, error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } })
  } catch (error) {
    // A concurrent delivery of the same event already recorded it.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
  }

  return NextResponse.json({ received: true })
}

async function handleEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object
      const userId = session.client_reference_id ?? session.metadata?.userId ?? null
      if (session.mode === 'subscription') {
        const subId = stripeId(session.subscription)
        if (subId) await syncSubscription(stripe, subId, { userId })
      } else if (session.mode === 'payment') {
        await grantPassFromCheckout(stripe, session)
      }
      // A delayed payment method completes checkout unpaid, then sends async_payment_succeeded.
      if (session.payment_status !== 'unpaid') {
        await track('checkout_completed', { offer: session.metadata?.offer ?? session.mode, amount: session.amount_total ?? null }, userId)
      }
      return
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      // syncSubscription re-fetches, so 'deleted' lands as CANCELED with endsAt = ended_at (now).
      await syncSubscription(stripe, event.data.object.id)
      return
    }

    case 'invoice.payment_failed': {
      const subId = invoiceSubscriptionId(event.data.object)
      if (!subId) return
      // Only if the invoice is still unpaid (a retry may have succeeded before this arrived).
      const invoice = event.data.object.id ? await stripe.invoices.retrieve(event.data.object.id) : null
      if (invoice && invoice.status === 'paid') return
      await syncSubscription(stripe, subId, { forcePastDue: true })
      return
    }

    case 'invoice.paid': {
      const subId = invoiceSubscriptionId(event.data.object)
      if (subId) await syncSubscription(stripe, subId)
      return
    }

    case 'charge.refunded': {
      await refundPassFromCharge(stripe, event.data.object)
      return
    }

    case 'charge.dispute.created': {
      await revokePassForDispute(stripe, event.data.object)
      return
    }

    case 'customer.deleted': {
      await forgetCustomer(event.data.object.id)
      return
    }

    default:
      console.log(`Unhandled webhook event type: ${event.type}`)
  }
}
