import { sendWelcome } from '@/lib/email/welcome'
import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { getAccess } from "@/lib/entitlements"
import { isAdminEmail } from "@/lib/admin"
import { track } from "@/lib/track"
import { safeRedirect } from "@/lib/auth-redirect"
import { cookies } from "next/headers"
import { SOURCE_COOKIE, decodeSource, sourceProps } from "@/lib/signup-source"
import { INVITE_COOKIE } from "@/lib/referral-rules"
import { linkReferral } from "@/lib/referrals"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    // Admin is an email allowlist, so only accept Google accounts whose email Google verified.
    signIn: async ({ account, profile }) =>
      account?.provider !== 'google' || (profile as { email_verified?: boolean } | undefined)?.email_verified !== false,
    // Same-origin only, deep links kept (src/lib/auth-redirect.ts).
    redirect: async ({ url, baseUrl }) => safeRedirect(url, baseUrl),
    session: async ({ session, user }) => {
      if (session?.user && user) {
        session.user.id = user.id
        // Add plan and other data from database user
        // One round of queries, not four in a row (each is a trip to the database).
        const [dbUser, jobApplicationsCount, access] = await Promise.all([prisma.user.findUnique({
          where: { id: user.id },
          select: {
            resumesCreated: true,
            totalResumesCreated: true,
            monthlyResumesCreated: true,
            resumeCountResetAt: true,
            monthlyTailors: true,
            tailorsResetAt: true,
            createdAt: true,
            lastActiveAt: true
          }
        }), prisma.jobApplication.count({ where: { userId: user.id } }), getAccess(user.id)])
        if (dbUser) {
          session.user.resumesCreated = dbUser.resumesCreated
          session.user.totalResumesCreated = dbUser.totalResumesCreated
          session.user.monthlyResumesCreated = dbUser.monthlyResumesCreated
          session.user.resumeCountResetAt = dbUser.resumeCountResetAt
          const now = new Date()
          const sameMonth = now.getUTCFullYear() === dbUser.tailorsResetAt.getUTCFullYear() &&
            now.getUTCMonth() === dbUser.tailorsResetAt.getUTCMonth()
          session.user.monthlyTailors = sameMonth ? dbUser.monthlyTailors : 0
          session.user.createdAt = dbUser.createdAt
          session.user.lastActiveAt = dbUser.lastActiveAt
        }
        
        session.user.resumesOptimized = jobApplicationsCount
        session.user.access = access
        session.user.isAdmin = isAdminEmail(session.user.email)
      }
      return session
    },
  },
  events: {
    // The adapter created the row on first Google sign-in.
    // The source cookie is set by middleware (src/lib/signup-source.ts).
    createUser: async ({ user }) => {
      let source = null
      let invite: string | undefined
      try {
        const jar = await cookies()
        source = decodeSource(jar.get(SOURCE_COOKIE)?.value)
        invite = jar.get(INVITE_COOKIE)?.value
      } catch {
        // Outside a request (tests, scripts): no cookie to read.
      }
      await track('signed_up', { provider: 'google', ...sourceProps(source) }, user.id)
      await linkReferral(user.id, invite)
      await sendWelcome(user)
    },
  },
  session: {
    strategy: "database",
  },
}