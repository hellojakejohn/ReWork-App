'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { MessageSquare, X } from "lucide-react"

interface FloatingFeedbackButtonProps {
  className?: string
}

export const FloatingFeedbackButton: React.FC<FloatingFeedbackButtonProps> = ({ className = "" }) => {
  const [isVisible, setIsVisible] = useState(true)

  const handleFeedbackClick = () => {
    console.log('Floating feedback button clicked!')
    window.open('https://reworksolutions.canny.io/', '_blank', 'noopener,noreferrer')
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className={`fixed bottom-6 right-6 z-40 ${className}`}>
      <div className="relative group">
        {/* Floating Feedback Button */}
        <Button variant="inverse" onClick={handleFeedbackClick} aria-label="Give feedback" className="relative z-10 h-14 w-14 p-0 shadow-float">
          <MessageSquare className="w-6 h-6" />
        </Button>

        {/* Close Button (appears on hover) */}
        <Button
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
          variant="secondary"
          size="icon-sm"
          aria-label="Hide feedback button"
          className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100"
        >
          <X className="w-3 h-3" />
        </Button>

        {/* Tooltip */}
        <div className="absolute bottom-16 right-0 bg-surface-raised text-text text-sm px-3 py-2 rounded-input shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap border border-input">
          Give Feedback
          <div className="absolute top-full right-4 w-2 h-2 bg-surface-raised border-r border-b border-input transform rotate-45 -translate-y-1"></div>
        </div>

      </div>
    </div>
  )
}

export default FloatingFeedbackButton