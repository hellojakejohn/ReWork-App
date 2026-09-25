"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { FREE_TAILORS_PER_MONTH, PRO_PRICE_DISPLAY } from "@/lib/plans"
import {
  User,
  Crown,
  Bell,
  Shield,
  Download,
  Calendar,
  Trash2,
  Settings,
  Sparkles,
  CheckCircle,
  CreditCard
} from "lucide-react"
import { AvatarColorPicker, UserAvatar } from "@/components/ui/avatar"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'account' | 'notifications' | 'privacy' | 'billing'

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('account')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [autoOptimization, setAutoOptimization] = useState(false)
  const [dataRetention, setDataRetention] = useState(true)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isManagingSubscription, setIsManagingSubscription] = useState(false)
  // Avatar state removed - now handled by AvatarColorPicker component

  const isPro = session?.user?.plan === "PREMIUM"

  const handleUpgrade = async () => {
    try {
      setIsUpgrading(true)
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (error) {
      console.error('Error upgrading:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upgrade')
    } finally {
      setIsUpgrading(false)
    }
  }

  const handleManageSubscription = async () => {
    try {
      setIsManagingSubscription(true)
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session')
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url
    } catch (error) {
      console.error('Error managing subscription:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to open subscription management')
    } finally {
      setIsManagingSubscription(false)
    }
  }

  // Check for upgrade success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('upgraded') === 'true') {
      toast.success('Welcome to Pro! You now have unlimited tailored resumes.')
      update() // Refresh session data
      // Clean up URL
      router.replace('/dashboard')
    }
  }, [router, update])

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
              <p className="text-sm text-slate-400 mb-6">Track your usage and manage your subscription.</p>
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

            {!isPro && (
              <div className="p-6 bg-gradient-to-br from-emerald-900/30 to-slate-900/20 border border-emerald-400/30 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="w-5 h-5 text-emerald-400" />
                  <span className="text-lg font-semibold text-white">Upgrade to Pro</span>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>

                <div className="grid grid-cols-1 gap-2 mb-4 text-sm">
                  {[
                    `Unlimited tailored resumes (Free: ${FREE_TAILORS_PER_MONTH}/month)`,
                    "Advanced AI optimization",
                    "Premium templates & designs",
                    "Priority customer support",
                    "Export to multiple formats"
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-slate-300">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isUpgrading ? "Redirecting..." : `Upgrade Now - ${PRO_PRICE_DISPLAY}`}
                </Button>
              </div>
            )}

            {isPro && (
              <div className="p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-emerald-400">Pro Plan Active</span>
                </div>
                <p className="text-sm text-slate-400 mb-3">
                  Pro plan active - manage billing through customer portal
                </p>
                <Button
                  onClick={handleManageSubscription}
                  disabled={isManagingSubscription}
                  variant="outline"
                  size="sm"
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                >
                  {isManagingSubscription ? "Loading..." : "Manage Subscription"}
                </Button>
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