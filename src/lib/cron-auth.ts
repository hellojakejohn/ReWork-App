import { timingSafeEqual } from 'crypto'

/** Vercel cron requests carry `Authorization: Bearer $CRON_SECRET`. Fails closed without the secret. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const given = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
