import "next-auth"
import type { Access } from "@/lib/entitlement-rules"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      access: Access // from getAccess(); the only "is Pro" answer on the client
      isAdmin: boolean
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
    resumesCreated: number
    totalResumesCreated: number
    monthlyResumesCreated: number
    resumeCountResetAt: Date
    createdAt: Date
    lastActiveAt: Date
    resumesOptimized: number
  }
}