// Signed unsubscribe links: no sign-in needed, can't be guessed for someone else.
// Token = base64url(id) + "." + HMAC-SHA256(NEXTAUTH_SECRET, "<scope>:" + id), first 32 chars.
// Scope "unsub" is a user's weekly email; "lead-unsub" is a free-tool lead (src/lib/leads.ts),
// so a lead token can never unsubscribe a user and the other way round.
import { createHmac, timingSafeEqual } from 'crypto'

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET?.trim()
  if (!s) throw new Error('NEXTAUTH_SECRET is not configured')
  return s
}

type Scope = 'unsub' | 'lead-unsub'
const mac = (id: string, key: string, scope: Scope) => createHmac('sha256', key).update(`${scope}:${id}`).digest('base64url').slice(0, 32)

export function unsubscribeToken(userId: string, key = secret(), scope: Scope = 'unsub'): string {
  return `${Buffer.from(userId).toString('base64url')}.${mac(userId, key, scope)}`
}

/** The user id a token belongs to, or null if it's malformed or forged. */
export function readUnsubscribeToken(token: string | null | undefined, key = secret(), scope: Scope = 'unsub'): string | null {
  if (!token || token.length > 200) return null
  const [idPart, sig] = token.split('.')
  if (!idPart || !sig) return null
  let userId: string
  try {
    userId = Buffer.from(idPart, 'base64url').toString('utf8')
  } catch {
    return null
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) return null
  const want = Buffer.from(mac(userId, key, scope))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got) ? userId : null
}

export const leadUnsubscribeToken = (leadId: string, key = secret()) => unsubscribeToken(leadId, key, 'lead-unsub')
export const readLeadUnsubscribeToken = (token: string | null | undefined, key = secret()) => readUnsubscribeToken(token, key, 'lead-unsub')
