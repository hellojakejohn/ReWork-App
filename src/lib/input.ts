// Small request-input helpers shared by API routes. Pure.

/** Trimmed string clipped to `max` chars; '' for anything that isn't a string. */
export const clip = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/** An http(s) URL (clipped), or null. Stored job links are rendered as hrefs. */
export function httpUrlOrNull(value: unknown, max = 2000): string | null {
  const url = clip(value, max)
  if (!/^https?:\/\//i.test(url)) return null
  try {
    return new URL(url).protocol.startsWith('http') ? url : null
  } catch {
    return null
  }
}

/** Up to `count` non-empty strings, each clipped to `max` chars. */
export const clipList = (value: unknown, count: number, max: number): string[] =>
  Array.isArray(value) ? value.map((v) => clip(v, max)).filter(Boolean).slice(0, count) : []
