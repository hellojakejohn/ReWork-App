"use client"

import { SessionProvider } from "next-auth/react"
import { FeedbackProvider } from "@/contexts/feedback-context"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <FeedbackProvider>
        {children}
      </FeedbackProvider>
    </SessionProvider>
  )
}