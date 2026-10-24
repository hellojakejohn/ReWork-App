"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export const avatarColors = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-slate-500',
  'bg-orange-500'
] as const

export type AvatarColor = typeof avatarColors[number]

interface UserAvatarProps {
  userId?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  name?: string
}

export function UserAvatar({ userId, className = "", size = 'md', name }: UserAvatarProps) {
  const { data: session } = useSession()
  const [selectedColor, setSelectedColor] = useState<AvatarColor>('bg-indigo-500')

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
    <div className={`${sizeClasses[size]} rounded-full ${selectedColor} flex items-center justify-center font-semibold text-white ${className}`}>
      {initials || 'U'}
    </div>
  )
}

export function AvatarColorPicker({ userId }: { userId?: string }) {
  const { data: session } = useSession()
  const [selectedColor, setSelectedColor] = useState<AvatarColor>('bg-indigo-500')

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
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        Avatar Color
      </label>
      <div className="flex gap-2">
        {avatarColors.map(color => (
          <button
            key={color}
            onClick={() => handleColorSelect(color)}
            className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white font-semibold text-sm transition-all ${
              selectedColor === color
                ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
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
  return 'bg-indigo-500'
}