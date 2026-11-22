// Sends one email through Resend's HTTP API (no SDK). Server only.
import { emailFrom, emailReplyTo, sendBlocker } from './config'

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
  /** One-click unsubscribe URL (RFC 8058): Gmail and Apple Mail show their own button. */
  unsubscribeUrl?: string
  /** Resend tags, for its dashboard. */
  tag?: string
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string }

export async function sendEmail(mail: OutgoingEmail, fetchFn: typeof fetch = fetch): Promise<SendResult> {
  const blocked = sendBlocker()
  if (blocked) return { ok: false, error: blocked }
  const headers: Record<string, string> = {}
  if (mail.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${mail.unsubscribeUrl}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }
  try {
    const res = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: emailFrom(),
        to: [mail.to],
        reply_to: emailReplyTo(),
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers,
        ...(mail.tag ? { tags: [{ name: 'kind', value: mail.tag }] } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!res.ok || !body.id) return { ok: false, error: `Resend ${res.status}: ${String(body.message ?? '').slice(0, 200)}` }
    return { ok: true, id: body.id }
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message || error).slice(0, 200) }
  }
}
