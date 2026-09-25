// schema.org JobPosting from <script type="application/ld+json">. Most career sites embed
// it for Google Jobs, so it's the best source after a known ATS API.
import * as cheerio from 'cheerio'
import { htmlToText } from './html-text'
import type { ResolvedJob } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

function flatten(node: Json, out: Json[] = []): Json[] {
  if (Array.isArray(node)) node.forEach((n) => flatten(n, out))
  else if (node && typeof node === 'object') {
    out.push(node)
    if (node['@graph']) flatten(node['@graph'], out)
  }
  return out
}

function isJobPosting(node: Json): boolean {
  const type = node?.['@type']
  return (Array.isArray(type) ? type : [type]).some((t) => typeof t === 'string' && /(^|\/)JobPosting$/i.test(t))
}

function parseJsonLoose(raw: string): Json | null {
  const text = raw
    .replace(/^\s*<!--|-->\s*$/g, '')
    .replace(/^\s*\/\/\s*<!\[CDATA\[|\/\/\s*\]\]>\s*$/g, '')
    .trim()
  try {
    return JSON.parse(text)
  } catch {
    // Some sites emit raw newlines/tabs inside strings.
    try {
      return JSON.parse(text.replace(/[\n\r\t]+/g, ' '))
    } catch {
      return null
    }
  }
}

function placeName(place: Json): string {
  if (typeof place === 'string') return place.trim()
  const address = place?.address ?? place
  if (typeof address === 'string') return address.trim()
  const country = typeof address?.addressCountry === 'object' ? s(address.addressCountry?.name) : s(address?.addressCountry)
  return [s(address?.addressLocality), s(address?.addressRegion), country].filter(Boolean).join(', ') || s(place?.name)
}

function locationOf(posting: Json): string {
  const places = (Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]).filter(Boolean)
  const names = [...new Set(places.map(placeName).filter(Boolean))]
  const remote = /TELECOMMUTE/i.test(s(posting.jobLocationType))
  const shown = names.slice(0, 3).join('; ') + (names.length > 3 ? ` +${names.length - 3} more` : '')
  if (remote) return shown ? `Remote (${shown})` : 'Remote'
  return shown
}

export function extractJsonLdJob(html: string, pageUrl: string): ResolvedJob | null {
  const $ = cheerio.load(html)
  const nodes: Json[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const parsed = parseJsonLoose($(el).text())
    if (parsed) flatten(parsed, nodes)
  })
  const posting = nodes.find(isJobPosting)
  if (!posting) return null

  const org = posting.hiringOrganization
  const description = htmlToText(s(posting.description), { strip: false })
  const title = s(posting.title) || s(posting.name)
  if (!title || description.length < 50) return null

  return {
    title,
    company: typeof org === 'string' ? org.trim() : s(org?.name),
    location: locationOf(posting),
    description,
    url: pageUrl,
    source: 'json-ld',
  }
}
