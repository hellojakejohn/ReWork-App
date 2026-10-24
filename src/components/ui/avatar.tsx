"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

// Brand palette for the avatar. Stored per user in localStorage by key; anything else
// (including the old Tailwind class names) falls back to forest.
export const avatarColors = ['forest', 'orange', 'green', 'ochre', 'sage'] as const

export type AvatarColor = typeof avatarColors[number]

const AVATAR_CLASSES: Record<AvatarColor, string> = {
  forest: 'bg-inverse text-inverse-fg',
  orange: 'bg-accent text-accent-fg',
  green: 'bg-success text-bg',
  ochre: 'bg-warn text-bg',
  sage: 'bg-sage text-text',
}

interface UserAvatarProps {
  userId?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  name?: string
}

export function UserAvatar({ userId, className = "", size = 'md', name }: UserAvatarProps) {
  const { data: session } = useSession()
  const [selectedColor, setSelectedColor] = useState<AvatarColor>('forest')

  // Get initials from name or session
  const displayName = name || session?.user?.name || 'User'
  const initials = displayName
    .split(' ')
    .map(part => part[0]?.toUpperCase() || '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-7 h-7 text-xs',
    lg: 'w-16 h-16 text-xl'
  }

  useEffect(() => {
    if (userId && typeof window !== 'undefined') {
      // Load saved color from localStorage
      const stored = localStorage.getItem(`avatar-color-${userId}`)
      if (stored && avatarColors.includes(stored as AvatarColor)) {
        setSelectedColor(stored as AvatarColor)
      } else {
        // Default to first color
        setSelectedColor(avatarColors[0])
      }
    }
  }, [userId])

  return (
    <div className={`${sizeClasses[size]} rounded-full ${AVATAR_CLASSES[selectedColor]} flex items-center justify-center font-semibold ${className}`}>
      {initials || 'U'}
    </div>
  )
}

export function AvatarColorPicker({ userId }: { userId?: string }) {
  const { data: session } = useSession()
  const [selectedColor, setSelectedColor] = useState<AvatarColor>('forest')

  const displayName = session?.user?.name || 'User'
  const initials = displayName
    .split(' ')
    .map(part => part[0]?.toUpperCase() || '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')

  useEffect(() => {
    if (userId && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`avatar-color-${userId}`)
      if (stored && avatarColors.includes(stored as AvatarColor)) {
        setSelectedColor(stored as AvatarColor)
      }
    }
  }, [userId])

  const handleColorSelect = (color: AvatarColor) => {
    setSelectedColor(color)
    if (userId && typeof window !== 'undefined') {
      localStorage.setItem(`avatar-color-${userId}`, color)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-text-muted">Avatar color</p>
      <div className="flex gap-2">
        {avatarColors.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => handleColorSelect(color)}
            aria-label={`Avatar color ${color}`}
            aria-pressed={selectedColor === color}
            className={`w-10 h-10 rounded-full ${AVATAR_CLASSES[color]} flex items-center justify-center font-semibold text-sm transition-transform ${
              selectedColor === color
                ? 'ring-2 ring-text ring-offset-2 ring-offset-surface'
                : 'hover:scale-110'
            }`}
          >
            {initials}
          </button>
        ))}
      </div>
    </div>
  )
}

// Keep these for backwards compatibility
export function saveAvatarSelection(userId: string, color: AvatarColor) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`avatar-color-${userId}`, color)
  }
}

export function getAvatarSelection(userId: string): AvatarColor {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`avatar-color-${userId}`)
    if (stored && avatarColors.includes(stored as AvatarColor)) {
      return stored as AvatarColor
    }
  }
  return 'forest'
}