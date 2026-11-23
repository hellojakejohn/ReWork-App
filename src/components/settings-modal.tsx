"use client"

import { useEffect, useState } from "react"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { Copy, Crown, CreditCard, Download, Gift, Mail, Settings, Shield, Trash2, User } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CONTACT_EMAIL, FREE_TAILORS_PER_MONTH } from "@/lib/plans"
import { NO_ACCESS } from "@/lib/entitlement-rules"
import { AccessSummary, OfferCards } from "@/components/billing/offer-cards"
import { AvatarColorPicker } from "@/components/ui/avatar"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  /** Tab to open on (the account menu's "Invite friends" opens "invite"). */
  initialTab?: TabType
}

export type TabType = "account" | "billing" | "invite" | "email" | "data"

export const isSettingsTab = (v: unknown): v is TabType => v === "account" || v === "billing" || v === "invite" || v === "email" || v === "data"

const TABS = [
  { id: "account" as const, label: "Account", icon: User },
  { id: "billing" as const, label: "Plan & billing", icon: CreditCard },
  { id: "invite" as const, label: "Invite friends", icon: Gift },
  { id: "email" as const, label: "Email", icon: Mail },
  { id: "data" as const, label: "Your data", icon: Shield },
]

export function SettingsModal({ isOpen, onClose, initialTab = "account" }: SettingsModalProps) {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  // Opening (or a new initialTab while open) jumps to that tab.
  const [synced, setSynced] = useState({ isOpen, initialTab })
  if (synced.isOpen !== isOpen || synced.initialTab !== initialTab) {
    setSynced({ isOpen, initialTab })
    if (isOpen) setActiveTab(initialTab)
  }
  const access = session?.user?.access ?? NO_ACCESS
  const isPro = access.isPro

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-surface border border-border flex flex-col gap-0 sm:max-w-[900px] max-w-[900px] w-[calc(100vw-2rem)] h-[min(640px,calc(100dvh-2rem))] p-0 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="shrink-0 sm:w-52 bg-surface-raised border-b sm:border-b-0 sm:border-r border-border p-4">
            <DialogHeader className="mb-4 sm:mb-6">
              <DialogTitle className="text-text flex items-center gap-2">
                <Settings className="w-4 h-4 text-text-secondary" />
                Settings
              </DialogTitle>
            </DialogHeader>
            <nav className="flex gap-1 overflow-x-auto sm:flex-col">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <Button
                    key={tab.id}
                    data-tab={tab.id}
                    variant={activeTab === tab.id ? "inverse" : "text"}
                    size="sm"
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    onClick={() => setActiveTab(tab.id)}
                    className="justify-start text-sm sm:w-full"
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </Button>
                )
              })}
            </nav>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {activeTab === "account" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-text mb-4">Account</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="settings-name" className="text-text-secondary text-sm">Name</Label>
                      <Input id="settings-name" value={session?.user?.name || ""} className="mt-1 bg-surface-raised" readOnly />
                    </div>
                    <div>
                      <Label htmlFor="settings-email" className="text-text-secondary text-sm">Email</Label>
                      <Input id="settings-email" value={session?.user?.email || ""} className="mt-1 bg-surface-raised" readOnly />
                    </div>
                    <p className="text-xs text-text-muted">Your name and email come from your Google account.</p>
                    <div className="flex items-center gap-3">
                      <Badge variant={isPro ? "default" : "secondary"} className="text-sm">
                        {isPro ? (
                          <>
                            <Crown className="w-3 h-3 mr-1" />
                            Pro
                          </>
                        ) : (
                          "Free"
                        )}
                      </Badge>
                      {session?.user?.createdAt && (
                        <span className="text-sm text-text-muted">Member since {new Date(session.user.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold text-text mb-4">Avatar color</h3>
                  <AvatarColorPicker userId={session?.user?.id} />
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-text mb-2">Plan & billing</h3>
                  <p className="text-sm text-text-muted">Your usage this month and how you pay for Pro.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-surface-raised rounded-card">
                    <p className="text-sm text-text-muted mb-1">Tailors this month</p>
                    <p className="font-serif text-3xl text-text">
                      {session?.user?.monthlyTailors ?? 0} / {isPro ? "fair use" : FREE_TAILORS_PER_MONTH}
                    </p>
                  </div>
                  <div className="p-4 bg-surface-raised rounded-card">
                    <p className="text-sm text-text-muted mb-1">Tailored resumes, all time</p>
                    <p className="font-serif text-3xl text-text">{session?.user?.resumesOptimized ?? 0}</p>
                  </div>
                </div>
                <AccessSummary access={access} />
                {access.source !== "STRIPE_SUBSCRIPTION" && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="w-4 h-4 text-text" />
                      <span className="font-semibold text-text">{isPro ? "Extend Pro" : "Go Pro"}</span>
                      <Link href="/pricing" onClick={onClose} className="ml-auto text-xs text-text-muted hover:text-text underline">
                        Compare plans
                      </Link>
                    </div>
                    <OfferCards access={access} compact />
                  </div>
                )}
              </div>
            )}

            {activeTab === "invite" && <InviteTab />}
            {activeTab === "email" && <EmailTab />}
            {activeTab === "data" && <DataTab />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ReferralInfo {
  available: boolean
  link?: string
  joined?: number
  rewarded?: number
  daysEarned?: number
  pendingForMe?: boolean
  days?: number
  monthlyCap?: number
}

function EmailTab() {
  const [weekly, setWeekly] = useState<boolean | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    fetch("/api/email/prefs")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { available: boolean; weekly?: boolean }) => {
        if (!live) return
        if (!data.available) setUnavailable(true)
        else setWeekly(!!data.weekly)
      })
      .catch(() => live && setUnavailable(true))
    return () => {
      live = false
    }
  }, [])

  const change = async (on: boolean) => {
    const before = weekly
    setWeekly(on)
    setSaving(true)
    try {
      const res = await fetch("/api/email/prefs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekly: on }) })
      if (!res.ok) throw new Error(String(res.status))
      toast.success(on ? "Weekly job emails are on." : "Weekly job emails are off.")
    } catch {
      setWeekly(before)
      toast.error("Couldn't save that. Try again in a minute.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text mb-2">Email</h3>
        <p className="text-sm text-text-secondary">
          On Mondays we send the best new jobs for your resume, each with its match and one tap to tailor. Nothing new that week, no email.
        </p>
      </div>
      {unavailable && <p className="text-sm text-text-muted">Email settings aren&apos;t available right now. Check back soon.</p>}
      {!unavailable && weekly === null && <p className="text-sm text-text-muted">Loading...</p>}
      {!unavailable && weekly !== null && (
        <label className="flex items-start gap-3 rounded-card bg-surface-raised p-4">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[rgb(var(--text))]"
            checked={weekly}
            disabled={saving}
            onChange={(e) => void change(e.currentTarget.checked)}
          />
          <span>
            <span className="block font-medium text-text">Weekly job matches</span>
            <span className="block text-sm text-text-muted">Jobs and match numbers only, never your resume text. Every email has a one-click unsubscribe.</span>
          </span>
        </label>
      )}
      <p className="text-xs text-text-muted">Receipts and account emails (like a deleted account) still come when they need to.</p>
    </div>
  )
}

function InviteTab() {
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    fetch("/api/referrals")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: ReferralInfo) => live && setInfo(data))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  const copy = async () => {
    if (!info?.link) return
    try {
      await navigator.clipboard.writeText(info.link)
      toast.success("Link copied. Send it to someone who's job hunting.")
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.")
    }
  }

  const days = info?.days ?? 7
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text mb-2">Invite friends, get Pro</h3>
        <p className="text-sm text-text-secondary">
          Know someone job hunting? Send them your link. When they finish their first tailored resume, you both get {days} days of Pro.
        </p>
      </div>
      {failed && <p className="text-sm text-text-muted">Couldn&apos;t load your link. Try again in a minute.</p>}
      {!failed && !info && <p className="text-sm text-text-muted">Loading your link...</p>}
      {info && !info.available && <p className="text-sm text-text-muted">Invites are almost ready. Check back soon.</p>}
      {info?.available && info.link && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={info.link} readOnly className="bg-surface-raised font-mono text-sm" aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={() => void copy()} className="shrink-0">
              <Copy className="h-4 w-4" /> Copy link
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-surface-raised rounded-card">
              <p className="text-sm text-text-muted mb-1">Joined</p>
              <p className="font-serif text-3xl text-text">{info.joined ?? 0}</p>
            </div>
            <div className="p-4 bg-surface-raised rounded-card">
              <p className="text-sm text-text-muted mb-1">Earned you Pro</p>
              <p className="font-serif text-3xl text-text">{info.rewarded ?? 0}</p>
            </div>
            <div className="p-4 bg-surface-raised rounded-card">
              <p className="text-sm text-text-muted mb-1">Pro days earned</p>
              <p className="font-serif text-3xl text-text">{info.daysEarned ?? 0}</p>
            </div>
          </div>
          {info.pendingForMe && (
            <p className="rounded-card bg-sage px-4 py-3 text-sm text-text">
              A friend invited you. Finish your first tailored resume and you both get {days} days of Pro.
            </p>
          )}
          <p className="text-xs text-text-muted">
            Your days are added on top of any Pro you already have. You can earn from up to {info.monthlyCap ?? 5} friends a month; your friends always get
            their days.
          </p>
        </>
      )}
    </div>
  )
}

function DataTab() {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState("")
  const [confirming, setConfirming] = useState(false)

  const download = async () => {
    setDownloading(true)
    setDownloadError("")
    try {
      const res = await fetch("/api/account/export")
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `rework-data-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError("We couldn't build your download. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text mb-2">Your data</h3>
        <p className="text-sm text-text-muted">
          We keep your resumes, tailored versions, cover letters and tracker in our database so you can come back to them. Text is sent to
          Anthropic’s Claude API to do the rewriting, and Anthropic doesn’t train on API data. Details in the{" "}
          <Link href="/privacy" className="underline hover:text-text">privacy policy</Link>.
        </p>
      </div>

      <div>
        <Label className="text-text-secondary font-medium mb-1 block">Download my data</Label>
        <p className="text-sm text-text-muted mb-3">A JSON file with your account, resumes, tailored versions, cover letters and tracker.</p>
        <Button variant="secondary" onClick={() => void download()} loading={downloading}>
          {!downloading && <Download className="w-4 h-4" />}
          Download my data
        </Button>
        {downloadError && <p className="mt-2 text-sm text-accent-strong">{downloadError}</p>}
      </div>

      <Separator />

      <div className="p-4 bg-removed rounded-card">
        <Label className="text-accent-strong font-semibold mb-1 block">Delete my account</Label>
        <p className="text-sm text-text-secondary mb-3">
          Cancels any Pro subscription, then permanently deletes your account, resumes, uploaded files, tailored versions, cover letters and
          tracker. This can’t be undone.
        </p>
        <Button size="sm" onClick={() => setConfirming(true)}>
          <Trash2 className="w-4 h-4" />
          Delete my account
        </Button>
      </div>

      <DeleteAccountDialog open={confirming} onClose={() => setConfirming(false)} />
    </div>
  )
}

function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [typed, setTyped] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const remove = async () => {
    setDeleting(true)
    setError("")
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Something went wrong. Nothing was deleted. Please try again.")
        setDeleting(false)
        return
      }
      await signOut({ callbackUrl: "/?deleted=1" })
    } catch {
      setError(`We couldn't reach the server. Please try again, or email ${CONTACT_EMAIL}.`)
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !deleting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-text">Delete your account?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-text-secondary">
          <p>This cancels any active Pro subscription right away (no further charges) and deletes everything: resumes, files, tailored versions, cover letters and your tracker.</p>
          <p>A Job Hunt Pass you’ve already used isn’t refunded. Stripe keeps its own receipts of past payments.</p>
          <label className="block">
            <span className="mb-1 block text-text-muted">Type DELETE to confirm</span>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          {error && <p className="text-accent-strong">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="text" onClick={onClose} disabled={deleting}>
            Keep my account
          </Button>
          <Button disabled={typed.trim() !== "DELETE"} loading={deleting} onClick={() => void remove()}>
            Delete everything
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
