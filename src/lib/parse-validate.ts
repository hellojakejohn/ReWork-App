// Post-parse validation. Pure, no AI. The model is told to copy only what's in the file;
// this checks that it did. Anything we can't find in the source text is dropped (never
// guessed at) and reported as a NeedsReviewItem so the user can check it.
import type { NeedsReviewItem, ParsedResume } from '@/types/parsed-resume'

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

/** Lowercase, alphanumerics only. Survives line breaks, spacing and punctuation differences. */
export function compact(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

/** URL without protocol, "www.", trailing slash or whitespace, lowercased. */
export function normalizeUrl(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/#?]+$/, '')
}

export class SourceIndex {
  private readonly lower: string
  private readonly compacted: string
  private readonly urlText: string
  private readonly phoneRuns: string[]

  constructor(source: string) {
    this.lower = source.toLowerCase()
    this.compacted = compact(source)
    this.urlText = source
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[a-z][a-z0-9+.-]*:\/\//g, '')
      .replace(/(^|[^a-z0-9.-])www\./g, '$1')
    this.phoneRuns = (source.match(/\+?[\d(][\d\s().\-–]{5,}\d/g) || []).map((run) => run.replace(/\D/g, ''))
  }

  hasText(value: string): boolean {
    const needle = compact(value)
    return needle.length > 0 && this.compacted.includes(needle)
  }

  hasEmail(value: string): boolean {
    return this.lower.includes(value.trim().toLowerCase())
  }

  hasPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '')
    if (digits.length < 7) return false
    // Allow a country code on either side ("+1 651..." vs "651...").
    return this.phoneRuns.some((run) => run.includes(digits) || (run.length >= 7 && digits.endsWith(run)))
  }

  hasUrl(value: string): boolean {
    const needle = normalizeUrl(value)
    if (needle.length < 4) return false
    let from = 0
    for (;;) {
      const at = this.urlText.indexOf(needle, from)
      if (at === -1) return false
      const after = this.urlText[at + needle.length]
      // "github.com/jj" must not match inside "github.com/jjohnson".
      if (!after || !/[a-z0-9_-]/.test(after)) return true
      from = at + 1
    }
  }
}

function uniqueIds<T extends { id: string }>(entries: T[], prefix: string): T[] {
  const used = new Set<string>()
  return entries.map((entry, i) => {
    let id = (entry.id || '').trim().replace(/[^A-Za-z0-9_-]/g, '') || `${prefix}_${i}`
    for (let n = i; used.has(id); n++) id = `${prefix}_${n}`
    used.add(id)
    return { ...entry, id }
  })
}

const trimAll = (items: string[] | undefined) => (items || []).map((s) => (s || '').trim()).filter(Boolean)

export function validateParsedResume(
  parsed: ParsedResume,
  sourceText: string
): { resume: ParsedResume; needsReview: NeedsReviewItem[] } {
  const src = new SourceIndex(sourceText)
  const needsReview: NeedsReviewItem[] = []
  const flag = (field: string, value: string, reason: string, entryId?: string) =>
    needsReview.push({ field, value, reason, ...(entryId ? { entryId } : {}) })

  // ----- contact -----
  const c = parsed.contact
  let fullName = (c.fullName || '').trim()
  if (fullName && !src.hasText(fullName)) {
    flag('contact.fullName', fullName, "This name isn't in your file.")
    fullName = ''
  }
  const headline = (c.headline || '').trim()
  if (fullName && headline && compact(fullName) === compact(headline)) {
    // Model put the title in the name slot (or vice versa). Don't guess which.
    flag('contact.fullName', fullName, 'Name and headline came out the same.')
    fullName = ''
  }

  let email = (c.email || '').trim()
  if (email && (!EMAIL_RE.test(email) || !src.hasEmail(email))) {
    flag('contact.email', email, EMAIL_RE.test(email) ? "This email isn't in your file." : "This isn't a valid email.")
    email = ''
  }

  let phone = (c.phone || '').trim()
  if (phone && !src.hasPhone(phone)) {
    flag('contact.phone', phone, "This phone number isn't in your file.")
    phone = ''
  }

  const seenLinks = new Set<string>()
  const links = (c.links || []).filter((link) => {
    const url = (link.url || '').trim()
    if (!url) return false
    const key = normalizeUrl(url)
    if (seenLinks.has(key)) return false
    if (!src.hasUrl(url)) {
      flag('contact.links', url, "This link isn't in your file.")
      return false
    }
    seenLinks.add(key)
    return true
  }).map((link) => ({ label: (link.label || '').trim(), url: link.url.trim() }))

  // ----- experience -----
  const experience = uniqueIds(parsed.experience || [], 'exp').map((exp) => {
    let company = (exp.company || '').trim()
    if (company && !src.hasText(company)) {
      flag('experience.company', company, "This company isn't in your file.", exp.id)
      company = ''
    }
    return {
      ...exp,
      title: (exp.title || '').trim(),
      company,
      location: (exp.location || '').trim(),
      startDate: (exp.startDate || '').trim(),
      endDate: (exp.endDate || '').trim(),
      current: !!exp.current,
      bullets: trimAll(exp.bullets),
    }
  })

  // ----- education -----
  const education = uniqueIds(parsed.education || [], 'edu').map((edu) => {
    let school = (edu.school || '').trim()
    if (school && !src.hasText(school)) {
      flag('education.school', school, "This school isn't in your file.", edu.id)
      school = ''
    }
    return {
      ...edu,
      school,
      credential: (edu.credential || '').trim(),
      field: (edu.field || '').trim(),
      startDate: (edu.startDate || '').trim(),
      endDate: (edu.endDate || '').trim(),
      details: trimAll(edu.details),
    }
  })

  // ----- projects -----
  const projects = uniqueIds(parsed.projects || [], 'proj').map((project) => {
    let url = (project.url || '').trim()
    if (url && !src.hasUrl(url)) {
      flag('projects.url', url, "This link isn't in your file.", project.id)
      url = ''
    }
    return {
      ...project,
      name: (project.name || '').trim(),
      url,
      dates: (project.dates || '').trim(),
      bullets: trimAll(project.bullets),
      tech: trimAll(project.tech),
    }
  })

  return {
    resume: {
      contact: { fullName, headline, email, phone, location: (c.location || '').trim(), links },
      summary: (parsed.summary || '').trim(),
      skills: (parsed.skills || [])
        .map((g) => ({ group: (g.group || '').trim(), items: trimAll(g.items) }))
        .filter((g) => g.items.length > 0),
      experience,
      projects,
      education,
      certifications: (parsed.certifications || [])
        .map((cert) => ({ name: (cert.name || '').trim(), issuer: (cert.issuer || '').trim(), date: (cert.date || '').trim() }))
        .filter((cert) => cert.name),
      extraSections: (parsed.extraSections || [])
        .map((s) => ({ heading: (s.heading || '').trim(), items: trimAll(s.items) }))
        .filter((s) => s.heading && s.items.length > 0),
    },
    needsReview,
  }
}
