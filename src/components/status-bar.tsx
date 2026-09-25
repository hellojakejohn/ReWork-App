"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { Zap } from "lucide-react"
import { FREE_TAILORS_PER_MONTH } from "@/lib/plans"
import { describeAccess } from "@/lib/entitlement-rules"

interface StatusBarProps {
  tailorsUsed?: number
  autoSaveStatus?: "saving" | "saved" | "error"
  className?: string
}

export default function StatusBar({ tailorsUsed, autoSaveStatus, className = "" }: StatusBarProps) {
  const { data: session } = useSession()
  const isPremium = !!session?.user?.access?.isPro

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur-md ${className}`}
      style={{ height: 'var(--status-bar-height)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[32px]">
          {/* Left Side - Plan Info or Auto-save Status */}
          <div className="flex items-center space-x-3 text-[12px]">
            {autoSaveStatus ? (
              <span className={`flex items-center gap-1.5 ${
                autoSaveStatus === 'saving' ? 'text-text-secondary' :
                autoSaveStatus === 'saved' ? 'text-success' :
                'text-destructive'
              }`}>
                {autoSaveStatus === 'saving' && (
                  <>
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                    Saving...
                  </>
                )}
                {autoSaveStatus === 'saved' && (
                  <>
                    <span className="w-1.5 h-1.5 bg-current rounded-full" />
                    All changes saved
                  </>
                )}
                {autoSaveStatus === 'error' && (
                  <>
                    <span className="w-1.5 h-1.5 bg-current rounded-full" />
                    Error saving changes
                  </>
                )}
              </span>
            ) : (
              <>
                <span className="text-text-secondary">
                  {isPremium && session ? describeAccess(session.user.access) : 'Free Plan'}
                </span>
                {!isPremium && tailorsUsed !== undefined && (
                  <>
                    <span className="text-text-muted">•</span>
                    <span className="text-text-secondary">
                      {tailorsUsed}/{FREE_TAILORS_PER_MONTH} tailors used this month
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          {/* Right Side - Upgrade Link */}
          {!isPremium && !autoSaveStatus && (
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Go Pro
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}