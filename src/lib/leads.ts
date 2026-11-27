// Free-tool leads (server only): the optional email card under /check and /fit results.
// Stores only the email, which tool, the ?ref= tag and the landing path. Never the job,
// the link or the resume. A lead is not an account and is never merged with one.
//
// Sending: one email per new lead (the checklist, or the missing keywords), behind
// EMAIL_LEADS (off by default: leads are stored, nothing sends). Card copy: src/lib/leads-shared.ts.
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site'
import { track } from '@/lib/track'
import { decodeSource } from '@/lib/signup-source'
import { cleanSkills, gapPlans, MAX_GAP_SKILLS } from '@/lib/gap-plan'
import { leadsMode, mailingAddress, sendBlocker } from '@/lib/email/config'
import { sendEmail } from '@/lib/email/send'
import { leadCheckEmail, leadFitEmail, type EmailContent, type Footer } from '@/lib/email/templates'
import { leadUnsubscribeToken } from '@/lib/email/unsubscribe'
import { LEAD_CONSENT_VERSION, MAX_LEAD_KEYWORDS, type LeadSource } from '@/lib/leads-shared'

/** The ref tag and landing path from the signup-source cookie (src/lib/signup-source.ts). */
export function leadContext(cookieValue: string | null | undefined): { ref: string; landing: string | null } {
  const src = decodeSource(cookieValue)
  return { ref: src?.s ?? 'direct', landing: src?.p ?? null }
}

export interface SaveLeadResult {
  created: boolean
  id: string
}

/**
 * Insert the lead once per (email, source). A repeat is not an error and changes nothing
 * (except a lead who unsubscribed and opts in again: that's fresh consent).
 */
export async function saveLead(email: string, source: LeadSource, ctx: { ref: string; landing: string | null }): Promise<SaveLeadResult> {
  const existing = await prisma.lead.findUnique({ where: { email_source: { email, source } }, select: { id: true, unsubscribedAt: true } })
  if (existing) {
    if (existing.unsubscribedAt) {
      await prisma.lead.update({ where: { id: existing.id }, data: { unsubscribedAt: null, consentVersion: LEAD_CONSENT_VERSION } })
      return { created: true, id: existing.id }
    }
    return { created: false, id: existing.id }
  }
  try {
    const lead = await prisma.lead.create({
      data: { email, source, ref: ctx.ref, landing: ctx.landing, consentVersion: LEAD_CONSENT_VERSION },
      select: { id: true },
    })
    return { created: true, id: lead.id }
  } catch (error) {
    // Two submits at once: the unique index caught the second one.
    if ((error as { code?: string })?.code === 'P2002') {
      const row = await prisma.lead.findUnique({ where: { email_source: { email, source } }, select: { id: true } })
      if (row) return { created: false, id: row.id }
    }
    throw error
  }
}

export const LEAD_WHY: Record<LeadSource, string> = {
  check: 'You get this because you asked for the checklist on ReWork\'s free job check.',
  fit: 'You get this because you asked for your missing keywords on ReWork\'s free fit check.',
}

export function leadFooter(leadId: string, source: LeadSource): Footer {
  const t = encodeURIComponent(leadUnsubscribeToken(leadId))
  return {
    siteUrl: SITE_URL,
    unsubscribeUrl: `${SITE_URL}/unsubscribe/lead?t=${t}`,
    settingsUrl: '',
    mailingAddress: mailingAddress() || '(mailing address not set)',
    why: LEAD_WHY[source],
  }
}

const signupUrl = (source: LeadSource) => `${SITE_URL}/auth/signin?callbackUrl=%2Fdashboard&utm_source=email&utm_medium=lead_${source}`

/** The email content for one lead. /fit tips come from cached gap plans only (no model call). */
export async function buildLeadEmail(leadId: string, source: LeadSource, missingRaw: string[] | undefined): Promise<EmailContent> {
  const footer = leadFooter(leadId, source)
  if (source === 'check') {
    return leadCheckEmail({ checkUrl: `${SITE_URL}/check?utm_source=email&utm_medium=lead_check`, signupUrl: signupUrl('check') }, footer)
  }
  const missing = cleanSkills(missingRaw ?? []).slice(0, MAX_LEAD_KEYWORDS)
  let tips: { skill: string; time: string; learn: string; build: string }[] = []
  if (missing.length) {
    const { plans } = await gapPlans(prisma, missing.slice(0, MAX_GAP_SKILLS), async () => [])
    tips = plans.filter((p) => p.closeable).map((p) => ({ skill: p.skill, time: p.time, learn: p.learn, build: p.build }))
  }
  return leadFitEmail({ missing, tips, fitUrl: `${SITE_URL}/fit?utm_source=email&utm_medium=lead_fit`, signupUrl: signupUrl('fit') }, footer)
}

/** Send (or dry-run) the one email a new lead asked for. Never throws. */
export async function sendLeadEmail(lead: { id: string; email: string; source: LeadSource; missing?: string[] }): Promise<void> {
  try {
    const mode = leadsMode()
    if (mode === 'off') return
    const content = await buildLeadEmail(lead.id, lead.source, lead.missing)
    const blocked = sendBlocker()
    if (mode === 'dry' || blocked) {
      console.log(`[leads] ${blocked ? `not sent (${blocked})` : 'dry run'}: ${lead.source} "${content.subject}"`)
      await track('lead_email', { source: lead.source, status: 'dry', error: blocked ?? undefined })
      return
    }
    const res = await sendEmail({
      to: lead.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      unsubscribeUrl: `${SITE_URL}/api/leads/unsubscribe?t=${encodeURIComponent(leadUnsubscribeToken(lead.id))}`,
      tag: `lead_${lead.source}`,
    })
    await track('lead_email', res.ok ? { source: lead.source, status: 'sent', resendId: res.id } : { source: lead.source, status: 'failed', error: res.error })
  } catch (error) {
    console.error('[leads] email failed:', (error as Error)?.message)
  }
}

/** Mark a lead unsubscribed. False when there's no such lead. */
export async function unsubscribeLead(leadId: string): Promise<{ ok: boolean; source?: LeadSource }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, source: true, unsubscribedAt: true } })
  if (!lead) return { ok: false }
  if (!lead.unsubscribedAt) await prisma.lead.update({ where: { id: lead.id }, data: { unsubscribedAt: new Date() } })
  return { ok: true, source: lead.source as LeadSource }
}
