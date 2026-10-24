"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ChevronDown, FileStack, History, Home, KanbanSquare, LogOut, RotateCcw, Settings, Sparkles, Tag, Wand2 } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
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
import { AIUsageBanner, AIUsageMeter, useAIUsage } from "./ai-usage"

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
  view = "flow",
}: {
  quota: Quota | null
  recentCount: number
  onOpenRecent?: () => void
  onUpgrade: () => void
  flow: FlowActions | null
  view?: "flow" | "tracker"
}) {
  const { data: session } = useSession()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  // Quota changes after every tailor/cover letter, so the usage bar refreshes with it.
  const aiUsage = useAIUsage(`${session?.user?.id}:${quota?.used ?? ""}:${quota?.remaining ?? ""}:${recentCount}`)

  const tailorsText = !quota
    ? ""
    : quota.limit === null
      ? "Pro: tailor every job"
      : `${quota.remaining} of ${quota.limit} tailors left`

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6">
        <Link
          href="/dashboard"
          onClick={(e) => {
            // Already on the flow: reset it in place instead of a no-op navigation.
            if (flow && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
              e.preventDefault()
              flow.onLogo()
            }
          }}
          aria-label="rework home"
          className="-ml-1 flex items-center rounded-input"
        >
          <Logo height={44} priority />
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {tailorsText && <span className="hidden text-xs text-text-muted sm:inline">{tailorsText}</span>}

          {view === "tracker" ? (
            <Link href="/dashboard" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-text-secondary hover:bg-surface-raised hover:text-text" title="Tailor">
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">Tailor</span>
            </Link>
          ) : (
            <Link href="/dashboard/tracker" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-text-secondary hover:bg-surface-raised hover:text-text" title="Application tracker">
              <KanbanSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Tracker</span>
            </Link>
          )}

          {recentCount > 0 && onOpenRecent && (
            <Button variant="text" size="sm" onClick={onOpenRecent} aria-label="Recent tailored resumes" title="Recent" className="text-sm">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Recent</span>
            </Button>
          )}

          {quota && !quota.isPro && (
            <Button variant="secondary" size="sm" onClick={onUpgrade}>
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade
            </Button>
          )}

          {session && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 rounded-full p-1 hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-text/40" aria-label="Account menu">
                <UserAvatar userId={session.user?.id} size="sm" />
                <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate text-sm font-semibold text-text">{session.user?.name}</div>
                  <div className="truncate text-xs text-text-muted">{session.user?.email}</div>
                  {tailorsText && <div className="mt-1 text-xs text-text-muted sm:hidden">{tailorsText}</div>}
                  <AIUsageMeter usage={aiUsage} />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
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
                <DropdownMenuSeparator />
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
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <div className="mb-1.5 text-xs text-text-muted">Theme</div>
                  <ThemeToggle />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setLogoutOpen(true)}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <AIUsageBanner usage={aiUsage} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LogoutModal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  )
}
