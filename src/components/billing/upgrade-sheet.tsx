"use client"

import { useSession } from "next-auth/react"
import { CheckCircle, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PRO_FEATURES } from "@/lib/plans"
import { NO_ACCESS } from "@/lib/entitlement-rules"
import { OfferCards } from "@/components/billing/offer-cards"

interface UpgradeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: string
}

/** Shown when a free user hits a limit (402 upgradeRequired) or picks a Pro-only feature. */
export function UpgradeSheet({ open, onOpenChange, reason }: UpgradeSheetProps) {
  const { data: session } = useSession()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface backdrop-blur-xl border border-input max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-text flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-text" />
            Get more with Pro
          </DialogTitle>
          <DialogDescription className="text-text-muted">
            {/* Opened from the Upgrade button there's no limit hit, so don't claim one. */}
            {reason || "Everything you need for a whole job search, fact-checked like your resume."}
          </DialogDescription>
        </DialogHeader>
        <OfferCards access={session ? session.user.access ?? NO_ACCESS : null} compact />
        <div>
          <p className="text-sm font-semibold text-text">Both plans get all of Pro. Only the billing differs.</p>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
