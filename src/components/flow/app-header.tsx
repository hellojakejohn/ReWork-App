"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ChevronDown, FileStack, History, Home, LogOut, RotateCcw, Settings, Sparkles, Tag } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { UserAvatar } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SettingsModal } from "@/components/settings-modal"
import { LogoutModal } from "@/components/logout-modal"
import type { Quota } from "./api"

/** Hooks into the one-page flow. Absent on other views, where the same items link back to it. */
export interface FlowActions {
  onLogo: () => void
  onManageResumes: () => void
  onStartOver: () => void
}

export function AppHeader({
  quota,
  recentCount,
  onOpenRecent,
  onUpgrade,
  flow,
}: {
  quota: Quota | null
  recentCount: number
  onOpenRecent?: () => void
  onUpgrade: () => void
  flow: FlowActions | null
}) {
  const { data: session } = useSession()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const tailorsText = !quota
    ? ""
    : quota.limit === null
      ? "Unlimited tailors"
      : `${quota.remaining} of ${quota.limit} tailors left`

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-white/5 bg-slate-950/90 px-4 backdrop-blur sm:px-6">
        <Link
          href="/dashboard"
          onClick={(e) => {
            // Already on the flow: reset it in place instead of a no-op navigation.
            if (flow && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
              e.preventDefault()
              flow.onLogo()
            }
          }}
          className="flex items-center gap-2"
        >
          <Logo size="xs" variant="simple" showBadge={false} />
          <span className="text-[15px] font-semibold tracking-tight text-slate-100">ReWork</span>
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {tailorsText && <span className="hidden text-xs text-slate-400 sm:inline">{tailorsText}</span>}

          {recentCount > 0 && onOpenRecent && (
            <button
              onClick={onOpenRecent}
              aria-label="Recent tailored resumes"
              title="Recent"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-white/5"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Recent</span>
            </button>
          )}

          {quota && !quota.isPro && (
            <button
              onClick={onUpgrade}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade
            </button>
          )}

          {session && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 rounded-lg p-1 hover:bg-white/5 focus:outline-none" aria-label="Account menu">
                <UserAvatar userId={session.user?.id} size="sm" />
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-white/10 bg-slate-900 text-slate-200">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate text-sm text-slate-100">{session.user?.name}</div>
                  <div className="truncate text-xs text-slate-400">{session.user?.email}</div>
                  {tailorsText && <div className="mt-1 text-xs text-slate-400 sm:hidden">{tailorsText}</div>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                {flow ? (
                  <>
                    <DropdownMenuItem onSelect={flow.onManageResumes}>
                      <FileStack className="mr-2 h-4 w-4" /> Manage resumes
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={flow.onStartOver}>
                      <RotateCcw className="mr-2 h-4 w-4" /> Start over
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard?open=manage">
                        <FileStack className="mr-2 h-4 w-4" /> Manage resumes
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard?open=start">
                        <RotateCcw className="mr-2 h-4 w-4" /> Start over
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" /> Settings & billing
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/?home=1">
                    <Home className="mr-2 h-4 w-4" /> Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/pricing">
                    <Tag className="mr-2 h-4 w-4" /> Pricing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onSelect={() => setLogoutOpen(true)}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LogoutModal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  )
}
