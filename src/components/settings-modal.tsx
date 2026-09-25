"use client"

import { useState } from "react"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { Crown, CreditCard, Download, Loader2, Settings, Shield, Trash2, User } from "lucide-react"
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
}

type TabType = "account" | "billing" | "data"

const TABS = [
  { id: "account" as const, label: "Account", icon: User },
  { id: "billing" as const, label: "Plan & billing", icon: CreditCard },
  { id: "data" as const, label: "Your data", icon: Shield },
]

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<TabType>("account")
  const access = session?.user?.access ?? NO_ACCESS
  const isPro = access.isPro

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900/95 backdrop-blur-xl border border-white/20 max-w-[900px] w-[calc(100vw-2rem)] h-[min(600px,calc(100vh-2rem))] p-0 overflow-hidden">
        <div className="flex h-full flex-col sm:flex-row">
          <div className="sm:w-48 bg-slate-800/50 border-b sm:border-b-0 sm:border-r border-white/10 p-4">
            <DialogHeader className="mb-4 sm:mb-6">
              <DialogTitle className="text-white text-lg flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-300" />
                Settings
              </DialogTitle>
            </DialogHeader>
            <nav className="flex gap-1 sm:flex-col">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    data-tab={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors sm:w-full ${
                      activeTab === tab.id ? "bg-white/10 text-white border border-white/20" : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "account" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Account</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="settings-name" className="text-slate-300 text-sm">Name</Label>
                      <Input id="settings-name" value={session?.user?.name || ""} className="mt-1 bg-slate-800/50 border-slate-600 text-white" readOnly />
                    </div>
                    <div>
                      <Label htmlFor="settings-email" className="text-slate-300 text-sm">Email</Label>
                      <Input id="settings-email" value={session?.user?.email || ""} className="mt-1 bg-slate-800/50 border-slate-600 text-white" readOnly />
                    </div>
                    <p className="text-xs text-slate-500">Your name and email come from your Google account.</p>
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
                        <span className="text-sm text-slate-400">Member since {new Date(session.user.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Separator className="bg-white/10" />
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Avatar color</h3>
                  <AvatarColorPicker userId={session?.user?.id} />
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Plan & billing</h3>
                  <p className="text-sm text-slate-400">Your usage this month and how you pay for Pro.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/30 border border-white/10 rounded-lg">
                    <p className="text-sm text-slate-400 mb-1">Tailors this month</p>
                    <p className="text-2xl font-bold text-white">
                      {session?.user?.monthlyTailors ?? 0} / {isPro ? "Unlimited" : FREE_TAILORS_PER_MONTH}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-800/30 border border-white/10 rounded-lg">
                    <p className="text-sm text-slate-400 mb-1">Tailored resumes, all time</p>
                    <p className="text-2xl font-bold text-white">{session?.user?.resumesOptimized ?? 0}</p>
                  </div>
                </div>
                <AccessSummary access={access} />
                {access.source !== "STRIPE_SUBSCRIPTION" && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold text-white">{isPro ? "Extend Pro" : "Go Pro"}</span>
                      <Link href="/pricing" onClick={onClose} className="ml-auto text-xs text-slate-400 hover:text-white underline">
                        Compare plans
                      </Link>
                    </div>
                    <OfferCards access={access} compact />
                  </div>
                )}
              </div>
            )}

            {activeTab === "data" && <DataTab />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
        <h3 className="text-lg font-semibold text-white mb-2">Your data</h3>
        <p className="text-sm text-slate-400">
          We keep your resumes, tailored versions, cover letters and tracker in our database so you can come back to them. Text is sent to
          OpenAI’s API to do the rewriting; OpenAI doesn’t train on API data. Details in the{" "}
          <Link href="/privacy" className="underline hover:text-white">privacy policy</Link>.
        </p>
      </div>

      <div>
        <Label className="text-slate-300 font-medium mb-1 block">Download my data</Label>
        <p className="text-sm text-slate-400 mb-3">A JSON file with your account, resumes, tailored versions, cover letters and tracker.</p>
        <Button variant="outline" onClick={() => void download()} disabled={downloading} className="border-slate-600 text-slate-200 hover:bg-slate-700">
          {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Download my data
        </Button>
        {downloadError && <p className="mt-2 text-sm text-red-300">{downloadError}</p>}
      </div>

      <Separator className="bg-white/10" />

      <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
        <Label className="text-red-300 font-medium mb-1 block">Delete my account</Label>
        <p className="text-sm text-slate-300 mb-3">
          Cancels any Pro subscription, then permanently deletes your account, resumes, uploaded files, tailored versions, cover letters and
          tracker. This can’t be undone.
        </p>
        <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
          <Trash2 className="w-4 h-4 mr-2" />
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
      <DialogContent className="bg-slate-900 border border-red-500/40 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Delete your account?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-300">
          <p>This cancels any active Pro subscription right away (no further charges) and deletes everything: resumes, files, tailored versions, cover letters and your tracker.</p>
          <p>A Job Hunt Pass you’ve already used isn’t refunded. Stripe keeps its own receipts of past payments.</p>
          <label className="block">
            <span className="mb-1 block text-slate-400">Type DELETE to confirm</span>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="bg-slate-800/50 border-slate-600 text-white" autoComplete="off" />
          </label>
          {error && <p className="text-red-300">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={deleting} className="text-slate-300 hover:bg-slate-700">
            Keep my account
          </Button>
          <Button variant="destructive" disabled={typed.trim() !== "DELETE" || deleting} onClick={() => void remove()}>
            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete everything
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
