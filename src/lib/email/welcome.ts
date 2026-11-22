// The welcome email, sent once on sign-up when EMAIL_WELCOME is on. Never throws: a
// failed welcome must not break sign-in.
import { SITE_URL } from '@/lib/site'
import { FREE_TAILORS_PER_MONTH } from '@/lib/plans'
import { track } from '@/lib/track'
import { sendBlocker, welcomeOn } from './config'
import { sendEmail } from './send'
import { welcomeEmail, type EmailContent } from './templates'
import { footerFor } from './weekly'
import { firstName } from './weekly-rules'

export const WELCOME_WHY = 'You get this because you just made a ReWork account.'

export function buildWelcome(userId: string, name: string | null): EmailContent {
  return welcomeEmail(
    { firstName: firstName(name), dashboardUrl: `${SITE_URL}/dashboard?utm_source=email&utm_medium=welcome`, freeTailors: FREE_TAILORS_PER_MONTH },
    footerFor(userId, WELCOME_WHY)
  )
}

export async function sendWelcome(user: { id: string; email?: string | null; name?: string | null }): Promise<void> {
  try {
    if (!welcomeOn() || !user.email || sendBlocker()) return
    const content = buildWelcome(user.id, user.name ?? null)
    const res = await sendEmail({ to: user.email, subject: content.subject, html: content.html, text: content.text, unsubscribeUrl: footerFor(user.id, WELCOME_WHY).unsubscribeUrl, tag: 'welcome' })
    await track('welcome_email', res.ok ? { status: 'sent', resendId: res.id } : { status: 'failed', error: res.error }, user.id)
  } catch (error) {
    console.error('[email] welcome failed:', (error as Error)?.message)
  }
}
