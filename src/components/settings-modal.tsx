"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { FREE_TAILORS_PER_MONTH } from "@/lib/plans"
import { NO_ACCESS } from "@/lib/entitlement-rules"
import { AccessSummary, OfferCards } from "@/components/billing/offer-cards"
import {
  User,
  Crown,
  Bell,
  Shield,
  Download,
  Calendar,
  Trash2,
  Settings,
  CreditCard
} from "lucide-react"
import { AvatarColorPicker, UserAvatar } from "@/components/ui/avatar"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'account' | 'notifications' | 'privacy' | 'billing'

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<TabType>('account')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [autoOptimization, setAutoOptimization] = useState(false)
  const [dataRetention, setDataRetention] = useState(true)
  // Avatar state removed - now handled by AvatarColorPicker component

  const access = session?.user?.access ?? NO_ACCESS
  const isPro = access.isPro

  // Avatar color is now handled by the AvatarColorPicker component

  const tabs = [
    { id: 'account' as const, label: 'Account', icon: User },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'privacy' as const, label: 'Privacy & Data', icon: Shield },
    { id: 'billing' as const, label: 'Usage & Billing', icon: CreditCard }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-slate-300 text-sm">Full Name</Label>
                    <Input
                      value={session?.user?.name || ''}
                      className="mt-1 bg-slate-800/50 border-slate-600 text-white focus:border-white/40 transition-colors"
                      readOnly
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Email</Label>
                    <Input
                      value={session?.user?.email || ''}
                      className="mt-1 bg-slate-800/50 border-slate-600 text-white focus:border-white/40 transition-colors"
                      readOnly
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">Plan Status</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge
                      variant={isPro ? "default" : "secondary"}
                      className="text-sm"
                    >
                      {isPro ? (
                        <>
                          <Crown className="w-3 h-3 mr-1" />
                          Pro Plan
                        </>
                      ) : (
                        "Free Plan"
                      )}
                    </Badge>
                    <span className="text-sm text-slate-400">
                      Member since {new Date(session?.user?.createdAt || new Date()).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-white/10" />

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Avatar Customization</h3>
              <AvatarColorPicker userId={session?.user?.id} />
              <p className="text-sm text-slate-400 mt-3">
                Your selected color will appear with your initials in the navigation bar.
              </p>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Notification Preferences</h3>
              <p className="text-sm text-slate-400 mb-6">Choose how you want to be notified about important updates.</p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-slate-300 font-medium">Email Notifications</Label>
                  <p className="text-sm text-slate-400 mt-1">Resume processing updates and tips</p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <Separator className="bg-white/10" />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-slate-300 font-medium">AI Optimization Alerts</Label>
                  <p className="text-sm text-slate-400 mt-1">Get notified when AI finds improvements</p>
                </div>
                <Switch
                  checked={autoOptimization}
                  onCheckedChange={setAutoOptimization}
                />
              </div>

              <Separator className="bg-white/10" />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-slate-300 font-medium">Weekly Summary</Label>
                  <p className="text-sm text-slate-400 mt-1">Get a weekly report of your resume activity</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        )

      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Privacy & Data Control</h3>
              <p className="text-sm text-slate-400 mb-6">Manage how your data is stored and used.</p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-slate-300 font-medium">Data Retention</Label>
                  <p className="text-sm text-slate-400 mt-1">Keep resume data for faster processing</p>
                </div>
                <Switch
                  checked={dataRetention}
                  onCheckedChange={setDataRetention}
                />
              </div>

              <Separator className="bg-white/10" />

              <div>
                <Label className="text-slate-300 font-medium mb-3 block">Export Your Data</Label>
                <p className="text-sm text-slate-400 mb-4">Download all your resume data and settings</p>
                <Button
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </div>

              <Separator className="bg-white/10" />

              <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                <Label className="text-red-400 font-medium mb-2 block">Delete Account</Label>
                <p className="text-sm text-slate-400 mb-4">
                  Permanently delete your account and all data. This cannot be undone.
                </p>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        )

      case 'billing':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Usage & Billing</h3>
              <p className="text-sm text-slate-400 mb-6">Track your usage and manage how you pay for Pro.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-800/30 border border-white/10 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Tailors This Month</p>
                <p className="text-2xl font-bold text-white">
                  {session?.user?.monthlyTailors ?? 0} / {isPro ? '∞' : FREE_TAILORS_PER_MONTH}
                </p>
              </div>
              <div className="p-4 bg-slate-800/30 border border-white/10 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Total Created</p>
                <p className="text-2xl font-bold text-white">{session?.user?.totalResumesCreated || session?.user?.resumesCreated || 0}</p>
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
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900/95 backdrop-blur-xl border border-white/20 max-w-[900px] h-[550px] p-0 overflow-hidden">
        <div className="flex h-full">
          {/* Left Sidebar - Tab Navigation */}
          <div className="w-48 bg-slate-800/50 border-r border-white/10 p-4">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-white text-lg flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-md flex items-center justify-center">
                  <Settings className="w-3 h-3 text-white" />
                </div>
                Settings
              </DialogTitle>
            </DialogHeader>

            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    data-tab={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-6 overflow-y-auto">
              {renderContent()}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-white/10 bg-slate-800/20">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button className="bg-white text-black hover:bg-white/90">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}