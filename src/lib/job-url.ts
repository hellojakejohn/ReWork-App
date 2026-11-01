// Job links without their tracking: "?utm_source=...&jdx_jid=...&gclid=..." comes off, the
// parts that find the job (path, ATS ids like gh_jid) stay. Pure and client-safe.

const TRACKING_PREFIXES = ['utm_', 'jdx_', 'mc_', '_hs', 'hsa_']
const TRACKING_KEYS = new Set(['gclid', 'fbclid', 'msclkid', 'dclid', 'yclid', 'igshid', 'jdx', 'trk', 'trackingid', 'refid', 'ref', 'rb', 'source', 'src', 'from', 'campaignid'])

function isTracking(key: string): boolean {
  const k = key.toLowerCase()
  return TRACKING_KEYS.has(k) || TRACKING_PREFIXES.some((p) => k.startsWith(p))
}

/** The link minus tracking parameters (and a stray second "?" inside the query). Unparseable input comes back as is. */
export function cleanJobUrl(raw: string): string {
  const trimmed = raw.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return trimmed
  }
  // "utm_medium=cpc?source=srm029" (a second "?" pasted in): read it as two parameters.
  const query = url.search.slice(1).replace(/\?/g, '&')
  const kept = new URLSearchParams()
  for (const [key, value] of new URLSearchParams(query)) {
    if (!isTracking(key)) kept.append(key, value)
  }
  const search = kept.toString()
  url.search = search ? `?${search}` : ''
  return url.toString()
}
