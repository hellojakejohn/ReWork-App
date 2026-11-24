// "I'll need visa sponsorship" lives in Settings and on this device only. Off by default, so
// the feed shows no visa lines or filters to anyone who didn't ask for them.
export const VISA_KEY = "rework:needs-sponsorship"
export const VISA_ONLY_KEY = "rework:sponsor-only"
/** Fired on window when Settings flips the flag, so an open feed updates without a reload. */
export const VISA_EVENT = "rework:visa-pref"

export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

export function writeFlag(key: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(key, "1")
    else window.localStorage.removeItem(key)
  } catch {}
  try {
    window.dispatchEvent(new Event(VISA_EVENT))
  } catch {}
}
