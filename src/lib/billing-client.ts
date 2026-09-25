// Client helpers for starting checkout / opening the Stripe portal.
import { toast } from 'sonner'
import type { OfferId } from '@/lib/plans'

function currentPath(): string {
  return window.location.pathname + window.location.search
}

export async function openPortal(returnTo = currentPath()): Promise<void> {
  const response = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnTo }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.url) {
    toast.error(data.error || 'Could not open the billing portal.')
    return
  }
  window.location.href = data.url
}

/** Redirects to Stripe Checkout. Resolves (without redirecting) if checkout was refused. */
export async function startCheckout(offer: OfferId, returnTo = currentPath()): Promise<void> {
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offer, returnTo }),
  })
  const data = await response.json().catch(() => ({}))
  if (response.status === 401) {
    window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`
    return
  }
  if (!response.ok || !data.url) {
    toast.error(data.error || 'Could not start checkout.', {
      duration: 10000,
      action: data.portal ? { label: 'Open portal', onClick: () => void openPortal(returnTo) } : undefined,
    })
    return
  }
  window.location.href = data.url
}
