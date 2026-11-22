"use client"

// One confetti burst plus two side bursts. Off for reduced motion. Used when someone goes
// Pro and when a tracked job reaches Interview or Offer.
import confetti from "canvas-confetti"

export function celebrate() {
  const base = { disableForReducedMotion: true, zIndex: 60 }
  confetti({ ...base, particleCount: 160, spread: 90, origin: { y: 0.55 } })
  setTimeout(() => {
    confetti({ ...base, particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } })
    confetti({ ...base, particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } })
  }, 250)
}
