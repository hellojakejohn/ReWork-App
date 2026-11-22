// Email settings, all from env. Nothing sends until Jake turns it on.
//
//   RESEND_API_KEY          Resend key (send.rework.careers is verified)
//   EMAIL_FROM              default "ReWork <hello@send.rework.careers>"
//   EMAIL_REPLY_TO          default support@rework.careers
//   EMAIL_MAILING_ADDRESS   the footer's postal address (CAN-SPAM). Required to send at all.
//   EMAIL_WEEKLY            off (default) | dry (log who would get what, send nothing)
//                           | admins (send only to ADMIN_EMAILS / Jake) | live (everyone)
//   EMAIL_WELCOME           1 to send the welcome email on sign-up
//   EMAIL_ADMIN_DIGEST      off (default) | dry | on: the daily numbers email to ADMIN_EMAILS
//                           (src/lib/email/admin-digest.ts)
export type WeeklyMode = 'off' | 'dry' | 'admins' | 'live'

const env = (n: string) => process.env[n]?.trim() || ''

export function weeklyMode(): WeeklyMode {
  const m = env('EMAIL_WEEKLY').toLowerCase()
  return m === 'dry' || m === 'admins' || m === 'live' ? m : 'off'
}

export const welcomeOn = () => /^(1|true|yes|on)$/i.test(env('EMAIL_WELCOME'))
export const emailFrom = () => env('EMAIL_FROM') || 'ReWork <hello@send.rework.careers>'
export const emailReplyTo = () => env('EMAIL_REPLY_TO') || 'support@rework.careers'
export const mailingAddress = () => env('EMAIL_MAILING_ADDRESS')

/** Why we can't send real email right now, or null when we can. */
export function sendBlocker(): string | null {
  if (!env('RESEND_API_KEY')) return 'RESEND_API_KEY is not set'
  if (!mailingAddress()) return 'EMAIL_MAILING_ADDRESS is not set (CAN-SPAM needs a postal address in every email)'
  return null
}
