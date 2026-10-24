import Image from 'next/image'
import { cn } from '@/lib/utils'

// Separate BetaBadge component for independent use
export function BetaBadge({ 
  size = 'medium', 
  className 
}: { 
  size?: 'xs' | 'small' | 'medium' | 'large'
  className?: string 
}) {
  const badgeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    small: 'text-xs px-2 py-0.5',
    medium: 'text-sm px-2.5 py-1',
    large: 'text-base px-3 py-1.5'
  }
  
  return (
    <span 
      className={cn(
        "bg-secondary-500/20 text-secondary-600 dark:text-secondary-400",
        "font-medium tracking-wider uppercase rounded-full",
        "border border-secondary-500/30",
        badgeClasses[size],
        className
      )}
    >
      Beta
    </span>
  )
}

interface LogoProps {
  variant?: 'detailed' | 'simple'
  size?: 'xs' | 'small' | 'medium' | 'large'
  className?: string
  badgePosition?: 'side' | 'below' | 'none'
  showBadge?: boolean
}

const sizeClasses = {
  xs: 'w-12 h-12',     // Perfect for navbar with cropped images
  small: 'w-40 h-40',  // 4x from w-10 h-10
  medium: 'w-64 h-64', // 4x from w-16 h-16
  large: 'w-80 h-80'   // 4x from w-20 h-20
}

export function Logo({
  variant = 'simple',
  size = 'medium',
  className,
  badgePosition = 'none',
  showBadge = false
}: LogoProps) {
  const src = variant === 'detailed' 
    ? '/rework-logo-detailed-cropped2.png' 
    : '/rework-logo-simple-cropped.png'
  
  const dimensions = {
    xs: { width: 80, height: 80 },         // Perfect for navbar with cropped images
    small: { width: 256, height: 256 },    // 4x from 64x64
    medium: { width: 384, height: 384 },   // 4x from 96x96
    large: { width: 640, height: 640 }     // 4x from 160x160
  }
  
  // Beta badge size based on logo size
  const badgeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    small: 'text-xs px-2 py-0.5',
    medium: 'text-sm px-2.5 py-1',
    large: 'text-base px-3 py-1.5'
  }
  
  // If showBadge is false, return only the logo image
  if (!showBadge) {
    return (
      <Image
        src={src}
        alt="ReWork Logo"
        width={dimensions[size].width}
        height={dimensions[size].height}
        className={cn(sizeClasses[size], 'object-contain', className)}
        priority
        unoptimized // For transparent PNGs
      />
    )
  }

  return (
    <div className={cn(
      "inline-flex items-center",
      badgePosition === 'below' ? "flex-col gap-1" : "gap-2"
    )}>
      <Image
        src={src}
        alt="ReWork Logo"
        width={dimensions[size].width}
        height={dimensions[size].height}
        className={cn(sizeClasses[size], 'object-contain', className)}
        priority
        unoptimized // For transparent PNGs
      />
      <span 
        className={cn(
          "bg-secondary-500/20 text-secondary-600 dark:text-secondary-400",
          "font-medium tracking-wider uppercase rounded-full",
          "border border-secondary-500/30",
          badgeClasses[size]
        )}
      >
        Beta
      </span>
    </div>
  )
}