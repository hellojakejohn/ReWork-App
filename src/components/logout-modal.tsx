"use client"

import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"
import { LogOut, X } from "lucide-react"

interface LogoutModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LogoutModal({ isOpen, onClose }: LogoutModalProps) {
  if (!isOpen) return null

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgb(var(--shadow)/0.45)] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md p-6 bg-surface border border-border rounded-panel shadow-float">
        {/* Close button */}
        <Button variant="text" size="icon-sm" onClick={onClose} aria-label="Close" className="absolute top-4 right-4">
          <X className="w-4 h-4" />
        </Button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-sage rounded-full flex items-center justify-center">
            <LogOut className="w-6 h-6 text-text" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h2 className="font-serif text-2xl font-semibold text-text mb-2">
            Sign out?
          </h2>
          <p className="text-sm text-text-muted">
            Your resumes and results stay saved for next time.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="inverse" className="flex-1" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}