// "Download my data" and "Delete my account" (server only).
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'
import { deleteUserFiles } from '@/lib/storage'
import { CONTACT_EMAIL } from '@/lib/plans'
import { track } from '@/lib/track'

// ---------- export ----------

/** Everything we hold about the user, as plain JSON. No OAuth tokens or session ids. */
export async function exportAccountData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      image: true,
      createdAt: true,
      entitlements: {
        select: { source: true, status: true, startsAt: true, endsAt: true, cancelAtPeriodEnd: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      resumes: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          isActive: true,
          hiddenAt: true,
          originalFileName: true,
          contactInfo: true,
          professionalSummary: true,
          workExperience: true,
          education: true,
          skills: true,
          projects: true,
          additionalSections: true,
          evidence: true,
          originalContent: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      applications: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          resumeId: true,
          jobTitle: true,
          company: true,
          jobUrl: true,
          jobDescription: true,
          status: true,
          notes: true,
          followUpAt: true,
          appliedAt: true,
          keywords: true,
          matchScore: true,
          optimizedStructured: true,
          coverLetter: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      feedback: { select: { type: true, message: true, createdAt: true } },
      events: { select: { name: true, props: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!user) return null

  const { resumes, applications, entitlements, feedback, events, ...profile } = user
  return {
    exportedAt: new Date().toISOString(),
    about:
      'Everything ReWork stores about your account. Resumes are your uploaded masters (deleted ones are marked isActive: false). Applications are your tailored resumes, cover letters and tracker entries. Payment card details are held by Stripe, not us.',
    profile,
    plan: entitlements,
    resumes: resumes.map(({ originalContent, ...r }) => ({
      ...r,
      extractedText: (originalContent as { rawText?: string } | null)?.rawText ?? null,
    })),
    applications: applications.map(({ optimizedStructured, ...a }) => ({ ...a, tailoredResume: optimizedStructured })),
    feedback,
    activity: events,
  }
}

// ---------- delete ----------

export class AccountDeletionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly userMessage: string
  ) {
    super(message)
    this.name = 'AccountDeletionError'
  }
}

// Stripe subscription statuses that can still bill or come back. Anything else is done.
const LIVE_SUB_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'])

const billingProblem = (detail: string) =>
  new AccountDeletionError(
    detail,
    503,
    `We couldn't cancel your subscription, so nothing was deleted. Please try again in a few minutes, or email ${CONTACT_EMAIL} and we'll do it by hand.`
  )

/**
 * Deletes the account in this order, stopping before anything is deleted if billing
 * can't be stopped:
 *   1. cancel every live Stripe subscription (immediately, no proration)
 *   2. delete the user's files in Supabase Storage (best effort, logged)
 *   3. delete the user row; foreign keys cascade to accounts, sessions, resumes,
 *      applications, feedback and entitlements, and null out events.userId
 * Stripe keeps its own payment records (receipts, invoices); we don't delete the customer.
 */
export async function deleteAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, stripeCustomerId: true, resumes: { select: { s3Key: true } } },
  })
  if (!user) throw new AccountDeletionError('User not found', 404, 'That account no longer exists.')

  // 1. Billing
  const subRows = await prisma.entitlement.findMany({
    where: { userId, source: 'STRIPE_SUBSCRIPTION', externalId: { not: null } },
    select: { externalId: true },
  })
  const canceled: string[] = []
  if (user.stripeCustomerId || subRows.length > 0) {
    const stripe = getStripe()
    if (!stripe) throw billingProblem('STRIPE_SECRET_KEY is not set')
    try {
      const live = new Map<string, string>() // id -> status
      if (user.stripeCustomerId) {
        const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 100 })
        for (const s of subs.data) live.set(s.id, s.status)
      }
      for (const row of subRows) {
        const id = row.externalId as string
        if (!live.has(id)) live.set(id, (await stripe.subscriptions.retrieve(id)).status)
      }
      for (const [id, status] of live) {
        if (!LIVE_SUB_STATUSES.has(status)) continue
        await stripe.subscriptions.cancel(id, { invoice_now: false, prorate: false })
        canceled.push(id)
      }
    } catch (error) {
      console.error('[account] Stripe cancel failed, not deleting:', error)
      throw billingProblem(`Stripe cancel failed: ${(error as Error)?.message}`)
    }
  }

  // 2. Files
  const files = await deleteUserFiles(
    userId,
    user.resumes.map((r) => r.s3Key).filter((k): k is string => !!k)
  )
  if (files.error) {
    // Greppable: these need a manual clean-up in Supabase Storage (users/<id>/resumes).
    console.error(`[ACCOUNT_DELETE_FILES_FAILED] user ${userId}: ${files.error}`)
  }

  // 3. The row (and, by cascade, everything else)
  await prisma.user.delete({ where: { id: userId } })

  await track('account_deleted', { canceledSubscriptions: canceled.length, filesDeleted: files.deleted, fileError: !!files.error })
  return { canceledSubscriptions: canceled, filesDeleted: files.deleted, fileError: files.error ?? null }
}
