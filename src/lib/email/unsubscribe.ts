// Signed unsubscribe links: no sign-in needed, can't be guessed for someone else.
// Token = base64url(userId) + "." + HMAC-SHA256(NEXTAUTH_SECRET, "unsub:" + userId), first 32 chars.
import { createHmac, timingSafeEqual } from 'crypto'

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET?.trim()
  if (!s) throw new Error('NEXTAUTH_SECRET is not configured')
  return s
}

const mac = (userId: string, key: string) => createHmac('sha256', key).update(`unsub:${userId}`).digest('base64url').slice(0, 32)

export function unsubscribeToken(userId: string, key = secret()): string {
  return `${Buffer.from(userId).toString('base64url')}.${mac(userId, key)}`
}

/** The user id a token belongs to, or null if it's malformed or forged. */
export function readUnsubscribeToken(token: string | null | undefined, key = secret()): string | null {
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
  const want = Buffer.from(mac(userId, key))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got) ? userId : null
}
