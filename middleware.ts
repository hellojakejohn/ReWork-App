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

export function middleware(request: NextRequest) {
  const hasSession = hasSessionCookie(request)
  const isLandingPage = request.nextUrl.pathname === '/'
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')

  // If user looks signed in and hits the landing page, send them to the dashboard.
  // We intentionally don't redirect away from /auth/signin on cookie presence: a stale
  // cookie (expired/deleted DB session) would loop signin -> dashboard -> signin.
  if (hasSession && isLandingPage) {
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
