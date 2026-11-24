import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Display form of a skill or job keyword. Job posts give them lowercase ("cash handling"), so an
 * all-lowercase name gets a capital first letter. Anything with a capital already (SQL, iOS, P&L)
 * is left as written.
 */
export function skillLabel(name: string): string {
  const s = name.trim()
  if (!s || s !== s.toLowerCase()) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
