// Stripe -> Entitlement sync. Called from the webhook route. Every handler is safe to run twice.
import type Stripe from 'stripe'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { mapStripeSubscriptionStatus, passWindow, restackPasses } from '@/lib/entitlement-rules'
import { currentChainEnd, refreshPlanMirror } from '@/lib/entitlements'
import { stripeId, subscriptionPeriodEnd } from '@/lib/stripe'

/** Serializes entitlement writes per user so stacked passes can't race each other. */
async function withUserLock<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`
    return fn(tx)
  })
}

async function resolveUserId(opts: { userId?: string | null; customerId?: string | null }): Promise<string | null> {
  if (opts.userId) {
    const u = await prisma.user.findUnique({ where: { id: opts.userId }, select: { id: true } })
    if (u) return u.id
  }
  if (opts.customerId) {
    const u = await prisma.user.findUnique({ where: { stripeCustomerId: opts.customerId }, select: { id: true } })
    if (u) return u.id
  }
  return null
}

async function linkCustomer(userId: string, customerId: string | null) {
  if (!customerId) return
  await prisma.user.updateMany({
    where: { id: userId, stripeCustomerId: null },
    data: { stripeCustomerId: customerId },
  })
}

/**
 * Upserts the STRIPE_SUBSCRIPTION entitlement from Stripe's current view of the subscription.
 * Always re-fetches, so out-of-order webhook deliveries can't roll state backwards.
 */
export async function syncSubscription(
  stripe: Stripe,
  subscriptionId: string,
  opts: { userId?: string | null; forcePastDue?: boolean } = {}
): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const customerId = stripeId(sub.customer)
  const userId = await resolveUserId({ userId: opts.userId ?? sub.metadata?.userId, customerId })
  if (!userId) {
    console.warn(`[stripe] subscription ${sub.id}: no matching user (customer ${customerId})`)
    return
  }
  await linkCustomer(userId, customerId)

  let status = mapStripeSubscriptionStatus(sub.status)
  if (!status) {
    // 'incomplete' / 'paused': nothing to grant. Leave any existing row alone.
    return
  }
  if (opts.forcePastDue && status === 'ACTIVE') status = 'PAST_DUE'

  const now = new Date()
  const periodEnd = subscriptionPeriodEnd(sub)
  // Newer portal cancellations set cancel_at instead of cancel_at_period_end.
  const cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000) : null
  const cancelAtPeriodEnd = sub.cancel_at_period_end || !!cancelAt
  let endsAt: Date | null = periodEnd
  if (cancelAt && (!endsAt || cancelAt < endsAt)) endsAt = cancelAt
  if (status === 'CANCELED') endsAt = sub.ended_at ? new Date(sub.ended_at * 1000) : now

  const priceId = sub.items?.data?.[0]?.price?.id ?? null

  await withUserLock(userId, async (tx) => {
    const existing = await tx.entitlement.findUnique({
      where: { source_externalId: { source: 'STRIPE_SUBSCRIPTION', externalId: sub.id } },
      select: { status: true, pastDueAt: true },
    })
    const pastDueAt =
      status === 'PAST_DUE' ? (existing?.status === 'PAST_DUE' && existing.pastDueAt ? existing.pastDueAt : now) : null

    const data = { status: status!, endsAt, cancelAtPeriodEnd, pastDueAt, stripePriceId: priceId }
    await tx.entitlement.upsert({
      where: { source_externalId: { source: 'STRIPE_SUBSCRIPTION', externalId: sub.id } },
      create: {
        userId,
        source: 'STRIPE_SUBSCRIPTION',
        externalId: sub.id,
        startsAt: new Date(sub.start_date * 1000),
        ...data,
      },
      update: data,
    })

    await tx.user.update({
      where: { id: userId },
      data:
        status === 'CANCELED'
          ? { stripeSubscriptionId: null, stripePriceId: null, stripeCurrentPeriodEnd: null }
          : { stripeSubscriptionId: sub.id, stripePriceId: priceId, stripeCurrentPeriodEnd: periodEnd },
    })
  })

  await refreshPlanMirror(userId)
}

/** A paid pass checkout: add 30 days, stacked after any pass still running. */
export async function grantPassFromCheckout(stripe: Stripe, session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') return // async methods finish via async_payment_succeeded

  const customerId = stripeId(session.customer)
  const userId = await resolveUserId({
    userId: session.client_reference_id ?? session.metadata?.userId,
    customerId,
  })
  if (!userId) {
    console.warn(`[stripe] pass checkout ${session.id}: no matching user`)
    return
  }
  await linkCustomer(userId, customerId)

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
  const priceId = lineItems.data[0]?.price?.id ?? null

  await withUserLock(userId, async (tx) => {
    const existing = await tx.entitlement.findUnique({
      where: { source_externalId: { source: 'STRIPE_PASS', externalId: session.id } },
      select: { id: true },
    })
    if (existing) return

    const now = new Date()
    const window = passWindow(now, await currentChainEnd(userId, 'STRIPE_PASS', now, tx))
    await tx.entitlement.create({
      data: {
        userId,
        source: 'STRIPE_PASS',
        status: 'ACTIVE',
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        externalId: session.id,
        stripePriceId: priceId,
      },
    })
  })

  await refreshPlanMirror(userId)
}

/** Full refund of a pass payment: mark it REFUNDED and slide any later passes back. */
export async function refundPassFromCharge(stripe: Stripe, charge: Stripe.Charge): Promise<void> {
  if (!charge.refunded) {
    console.log(`[stripe] charge ${charge.id} partially refunded; leaving entitlements as-is`)
    return
  }
  const paymentIntentId = stripeId(charge.payment_intent)
  if (!paymentIntentId) return

  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 })
  const session = sessions.data[0]
  if (!session || session.mode !== 'payment') return // not a pass (subscription invoices are handled by status)

  const row = await prisma.entitlement.findUnique({
    where: { source_externalId: { source: 'STRIPE_PASS', externalId: session.id } },
  })
  if (!row || row.status === 'REFUNDED') return

  await withUserLock(row.userId, async (tx) => {
    const now = new Date()
    await tx.entitlement.update({ where: { id: row.id }, data: { status: 'REFUNDED' } })

    const later = await tx.entitlement.findMany({
      where: { userId: row.userId, source: 'STRIPE_PASS', status: 'ACTIVE', startsAt: { gte: row.startsAt } },
      select: { id: true, startsAt: true, endsAt: true, createdAt: true },
    })
    const chainStart = row.startsAt > now ? row.startsAt : now
    const restacked = restackPasses(
      later.filter((r): r is typeof r & { endsAt: Date } => r.endsAt !== null),
      chainStart
    )
    for (const r of restacked) {
      await tx.entitlement.update({ where: { id: r.id }, data: { startsAt: r.startsAt, endsAt: r.endsAt } })
    }
  })

  await refreshPlanMirror(row.userId)
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription
  return stripeId(fromParent ?? legacy ?? null)
}
