// The optional email card under the free tools' results (/check, /fit). Client-safe: copy,
// input rules and the show/hide logic. The server side is src/lib/leads.ts.
import { z } from 'zod'

export type LeadSource = 'check' | 'fit'
export const LEAD_SOURCES: readonly LeadSource[] = ['check', 'fit']

/** Bump when the card's promise changes; each lead keeps the version it agreed to. */
export const LEAD_CONSENT_VERSION = 'lead-2026-11-25'

export const LEAD_COPY: Record<LeadSource, { prompt: string; button: string; done: string }> = {
  check: {
    prompt: 'Want the ghost-job red flags checklist + a heads-up when we add new checks? Drop your email.',
    button: 'Send it',
    done: 'Sent. Check your inbox for the checklist.',
  },
  fit: {
    prompt: 'Want your missing keywords emailed + tips to close the gap? Drop your email.',
    button: 'Send it',
    done: 'Sent. Check your inbox for your missing keywords.',
  },
}
export const LEAD_FINE_PRINT = 'No spam. One-click unsubscribe.'

export const MAX_LEAD_KEYWORDS = 20

export const leadInput = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  source: z.enum(['check', 'fit']),
  /** /fit only: the missing keywords to email. Used for that one email, never stored. */
  missing: z.array(z.string().max(80)).max(40).optional(),
  /** Honeypot: hidden from people, bots fill it. */
  website: z.string().max(200).optional(),
})
export type LeadInput = z.infer<typeof leadInput>

// ---------- show / hide ----------

export type LeadCardMemory = 'dismissed' | 'sent' | null
export const leadStorageKey = (source: LeadSource) => `rw_lead_${source}`

interface MiniStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** What this browser remembers about the card. Storage can throw (private mode, blocked). */
export function readLeadMemory(source: LeadSource, storage: MiniStorage | null | undefined): LeadCardMemory {
  try {
    const v = storage?.getItem(leadStorageKey(source))
    return v === 'dismissed' || v === 'sent' ? v : null
  } catch {
    return null
  }
}

export function writeLeadMemory(source: LeadSource, value: 'dismissed' | 'sent', storage: MiniStorage | null | undefined): void {
  try {
    storage?.setItem(leadStorageKey(source), value)
  } catch {
    // Not remembered; the card just shows again next time.
  }
}

/**
 * Show the card only under a finished result, never before it, and not once this browser
 * dismissed it or already sent an email. `justSent` keeps the thank-you line in view.
 */
export function showLeadCard(opts: { hasResult: boolean; memory: LeadCardMemory; justSent?: boolean }): boolean {
  if (!opts.hasResult) return false
  if (opts.justSent) return true
  return opts.memory === null
}
