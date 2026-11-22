// Referral rules, pure (src/lib/referrals.ts does the database work).
// Invite a friend with your link; when they finish their first tailor you both get
// REFERRAL_DAYS of Pro. The referrer's side is capped per calendar month so a pile of
// throwaway accounts can't farm free Pro; the friend always gets theirs.

export const REFERRAL_DAYS = 7
export const REFERRER_MONTHLY_CAP = 5
export const INVITE_PARAM = 'invite'
export const INVITE_COOKIE = 'rw_invite'
export const INVITE_COOKIE_DAYS = 30

// No 0/O, 1/I/L: codes get read aloud and typed from phones.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 8

/** A random invite code. `random` returns bytes; injectable for tests. */
export function newInviteCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(CODE_LENGTH)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

/** Uppercased code if it could be one of ours, else null. */
export function cleanInviteCode(value: string | null | undefined): string | null {
  const code = (value ?? '').trim().toUpperCase()
  if (code.length !== CODE_LENGTH) return null
  for (const ch of code) if (!ALPHABET.includes(ch)) return null
  return code
}

export function inviteLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/?${INVITE_PARAM}=${code}`
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** Whether the referrer still gets days this month, given how many they've earned so far. */
export function referrerEligible(rewardedThisMonth: number): boolean {
  return rewardedThisMonth < REFERRER_MONTHLY_CAP
}
