import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { appBaseUrl, billingUnavailable, getStripe, safeReturnPath } from '@/lib/stripe'

// POST { returnTo?: '/some/path' } -> { url } for the Stripe Customer Portal.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stripe = getStripe()
  if (!stripe) return billingUnavailable('Billing portal')

  let body: { returnTo?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    // body is optional
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account yet. Buy Pro first.' }, { status: 400 })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appBaseUrl(request)}${safeReturnPath(request, body.returnTo, '/pricing')}`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json({ error: 'Could not open the billing portal.' }, { status: 500 })
  }
}
