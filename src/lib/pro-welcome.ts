import type { Access } from '@/lib/entitlement-rules'
import { PRO_FEATURES } from '@/lib/plans'

/** The few Pro perks worth calling out the moment someone pays. */
export const PRO_WELCOME_HIGHLIGHTS = [PRO_FEATURES[0], PRO_FEATURES[1], PRO_FEATURES[2], PRO_FEATURES[5]]

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Copy for the "You're Pro" popup shown after checkout. */
export function proWelcome(access: Access, name?: string | null): { title: string; detail: string } {
  const first = name?.trim().split(/\s+/)[0]
  const title = first ? `You're Pro, ${first}.` : "You're Pro."
  const until = access.endsAt ? shortDate(access.endsAt) : null
  switch (access.source) {
    case 'STRIPE_PASS':
      return {
        title,
        detail: until
          ? `Your Job Hunt Pass runs until ${until}. It never renews, so there's nothing to cancel.`
          : "Your Job Hunt Pass is on. It never renews, so there's nothing to cancel.",
      }
    case 'STRIPE_SUBSCRIPTION':
      return {
        title,
        detail: until
          ? `Pro Monthly renews ${until}. Cancel any time from Manage billing.`
          : 'Pro Monthly is on. Cancel any time from Manage billing.',
      }
    default:
      return { title, detail: until ? `Pro is on until ${until}.` : 'Pro is on.' }
  }
}
