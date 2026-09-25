import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      plan: 'FREE' | 'PREMIUM'
      resumesCreated: number
      totalResumesCreated: number
      monthlyResumesCreated: number
      resumeCountResetAt: Date
      monthlyTailors: number // already reset to 0 when a new month started
      createdAt: Date
      lastActiveAt: Date
      resumesOptimized: number
    }
  }

  interface User {
    id: string
    plan: 'FREE' | 'PREMIUM'
    resumesCreated: number
    totalResumesCreated: number
    monthlyResumesCreated: number
    resumeCountResetAt: Date
    createdAt: Date
    lastActiveAt: Date
    resumesOptimized: number
  }
}