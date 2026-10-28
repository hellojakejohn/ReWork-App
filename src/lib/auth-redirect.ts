// Where NextAuth may send someone after sign-in or sign-out. Pure, so it's unit tested.
//
// Only same-origin targets are allowed (absolute on our origin, or a relative path), so
// a crafted callbackUrl can't bounce a fresh session to another site. Deep links survive
// (/dashboard/tracker, /pricing, /dashboard?application=...). The sign-in page itself
// and the NextAuth API go to the dashboard instead, so nothing loops.
export const AFTER_SIGN_IN = '/dashboard'

export function safeRedirect(url: string, baseUrl: string): string {
  const base = new URL(baseUrl)
  const fallback = new URL(AFTER_SIGN_IN, base).href
  let target: URL
  try {
    // Relative paths only when they really are paths: not //host or /\host.
    if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) target = new URL(url, base)
    else target = new URL(url)
  } catch {
    return fallback
  }
  if (target.origin !== base.origin) return fallback
  if (target.pathname.startsWith('/auth/') || target.pathname.startsWith('/api/auth')) return fallback
  return target.href
}
