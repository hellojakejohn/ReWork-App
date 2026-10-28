import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth uses the database session strategy (Prisma adapter), so the session cookie
// holds an opaque session token, not a JWT. getToken() from next-auth/jwt can't decode
// it and always returned null, which bounced every hard load of /dashboard to sign-in.
//
// Middleware runs on the edge and can't hit Prisma, so it only checks that a session
// cookie is present to decide on redirects. Real auth happens server-side with
// getServerSession (API routes) and useSession (client pages).
const SESSION_COOKIES = ['__Secure-next-auth.session-token', 'next-auth.session-token']

function hasSessionCookie(request: NextRequest) {
  return SESSION_COOKIES.some((name) => !!request.cookies.get(name)?.value)
}

// Server-to-server callers: no browser, no cookies, their own auth (signature, secret).
const NO_ORIGIN_CHECK = ['/api/stripe/webhook', '/api/cron/', '/api/keepalive', '/api/csp-report']

/**
 * A state-changing API request from a browser on another site. SameSite=Lax cookies
 * already stop most cross-site writes, but any page on a sibling *.hellojakejohn.com
 * subdomain counts as same-site, so check the Origin too. No Origin (curl, server
 * calls) carries no victim's cookies, so it isn't CSRF.
 */
function isCrossOriginWrite(request: NextRequest): boolean {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false
  if (NO_ORIGIN_CHECK.some((p) => pathname.startsWith(p))) return false
  const origin = request.headers.get('origin')
  return !!origin && origin !== request.nextUrl.origin
}

export function middleware(request: NextRequest) {
  if (isCrossOriginWrite(request)) {
    return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 })
  }

  const hasSession = hasSessionCookie(request)
  const isLandingPage = request.nextUrl.pathname === '/'
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')

  // If user looks signed in and hits the landing page, send them to the dashboard,
  // unless they asked for it (account menu -> Home links to /?home=1).
  // We intentionally don't redirect away from /auth/signin on cookie presence: a stale
  // cookie (expired/deleted DB session) would loop signin -> dashboard -> signin.
  if (hasSession && isLandingPage && !request.nextUrl.searchParams.has('home')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // No session cookie at all -> protected routes go to sign-in
  if (!hasSession && isDashboardRoute) {
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes - CRITICAL!)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}
