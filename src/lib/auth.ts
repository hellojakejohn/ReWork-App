import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { getAccess } from "@/lib/entitlements"
import { isAdminEmail } from "@/lib/admin"
import { track } from "@/lib/track"

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
    redirect: async ({ url, baseUrl }) => {
      // Always redirect to dashboard after successful sign in
      if (url.startsWith(baseUrl)) {
        return `${baseUrl}/dashboard`
      }
      return url
    },
    session: async ({ session, user }) => {
      if (session?.user && user) {
        session.user.id = user.id
        // Add plan and other data from database user
        const dbUser = await prisma.user.findUnique({
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
        })
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
        
        // Get job applications count for "resumes optimized"
        const jobApplicationsCount = await prisma.jobApplication.count({
          where: { userId: user.id }
        })
        session.user.resumesOptimized = jobApplicationsCount
        session.user.access = await getAccess(user.id)
        session.user.isAdmin = isAdminEmail(session.user.email)
      }
      return session
    },
  },
  events: {
    // The adapter created the row on first Google sign-in.
    createUser: async ({ user }) => {
      await track('signed_up', { provider: 'google' }, user.id)
    },
  },
  session: {
    strategy: "database",
  },
}