"use client"

import { useSession } from "next-auth/react"
import { CheckCircle, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FREE_TAILORS_PER_MONTH, PRO_FEATURES } from "@/lib/plans"
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
      <DialogContent className="bg-slate-900/95 backdrop-blur-xl border border-white/20 max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            {reason ? "Get more with Pro" : "Keep tailoring with Pro"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {reason || `You've used all ${FREE_TAILORS_PER_MONTH} free tailored resumes this month.`}
          </DialogDescription>
        </DialogHeader>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <OfferCards access={session ? session.user.access ?? NO_ACCESS : null} compact />
      </DialogContent>
    </Dialog>
  )
}
