// Apply assist (docs/job-feed-plan.md, chunk 7). The Chrome extension runs fillPage() on the
// application form the user has open, after they click the ReWork button there. It fills
// empty text fields from the application kit (contact, tailored resume PDF, cover letter,
// saved answers), marks what it filled, and says "check everything, then submit".
//
// It never submits, never touches dropdowns, checkboxes or radios (work authorization,
// demographics: the person answers those), and never overwrites what is already typed.
// Bundled for the extension by scripts/build-extension.ts (apply-fill.js).

export interface ApplyPacket {
  applicationId: string
  jobTitle: string
  company: string
  contact: {
    firstName: string
    lastName: string
    fullName: string
    email: string
    phone: string
    location: string
    linkedin: string
    github: string
    website: string
  }
  coverLetter: string
  answers: { question: string; answer: string }[]
  /** The tailored resume as a PDF, added by the extension (base64), when it could fetch it. */
  resume?: { name: string; type: string; base64: string }
}

export type FieldKind =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'location'
  | 'linkedin'
  | 'github'
  | 'website'
  | 'coverLetter'
  | 'resumeFile'
  | 'question'
  | null

/** "Jane van der Berg" -> Jane / van der Berg. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/**
 * What a form field asks for, from everything that describes it (label, name, id,
 * placeholder, autocomplete). Null when we shouldn't touch it.
 */
export function fieldKind(f: { text: string; tag: 'input' | 'textarea'; type: string; autocomplete?: string }): FieldKind {
  const t = f.text.toLowerCase().replace(/[_\-[\]]+/g, ' ')
  const ac = (f.autocomplete ?? '').toLowerCase()
  const type = f.type.toLowerCase()

  if (type === 'file') {
    if (/cover/.test(t)) return null
    return /resume|résumé|\bcv\b|curriculum/.test(t) || !t.trim() ? 'resumeFile' : null
  }
  if (['checkbox', 'radio', 'hidden', 'submit', 'button', 'password', 'date', 'number', 'search'].includes(type)) return null
  // Questions we never answer for anyone.
  if (/salary|compensation|pay expectation|sponsor|visa|authori[sz]ed|gender|race|ethnic|veteran|disabilit|pronoun|birth|age\b|ssn|social security|referr|how did you hear|password/.test(t)) return null

  if (ac === 'given-name' || /\bfirst name\b|\bgiven name\b|\bfname\b|^first$/.test(t)) return 'firstName'
  if (ac === 'family-name' || /\blast name\b|\bsurname\b|\bfamily name\b|\blname\b|^last$/.test(t)) return 'lastName'
  if (ac === 'email' || type === 'email' || /e-?mail/.test(t)) return 'email'
  if (ac === 'tel' || type === 'tel' || /phone|mobile|\btel\b|cell/.test(t)) return 'phone'
  if (/linkedin/.test(t)) return 'linkedin'
  if (/github/.test(t)) return 'github'
  if (/portfolio|website|personal site|\bblog\b|other url|\burl\b/.test(t)) return 'website'
  if (ac === 'name' || /full name|^\s*name\s*\*?\s*$|your name|legal name/.test(t)) return 'fullName'
  if (/cover letter/.test(t)) return f.tag === 'textarea' ? 'coverLetter' : null
  if (/\b(city|location|where are you based|current location)\b/.test(t) && !/relocat/.test(t)) return 'location'
  if (f.tag === 'textarea' && t.trim().length >= 12) return 'question'
  return null
}

const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'or', 'you', 'your', 'do', 'why', 'what', 'how', 'is', 'are', 'in', 'at', 'for', 'this', 'with', 'about', 'us', 'we', 'our', 'tell', 'please', 'describe'])
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))

/** The saved answer whose question is this one (most shared words, at least half of them). */
export function matchAnswer(question: string, answers: { question: string; answer: string }[]): string | null {
  const q = words(question)
  if (q.size === 0) return null
  let best: { score: number; answer: string } | null = null
  for (const a of answers) {
    const w = words(a.question)
    if (w.size === 0) continue
    const shared = [...q].filter((x) => w.has(x)).length
    const score = shared / Math.min(q.size, w.size)
    if (score >= 0.5 && (!best || score > best.score)) best = { score, answer: a.answer }
  }
  return best?.answer ?? null
}

export function valueFor(kind: FieldKind, packet: ApplyPacket, text: string): string | null {
  const c = packet.contact
  switch (kind) {
    case 'firstName':
      return c.firstName || null
    case 'lastName':
      return c.lastName || null
    case 'fullName':
      return c.fullName || null
    case 'email':
      return c.email || null
    case 'phone':
      return c.phone || null
    case 'location':
      return c.location || null
    case 'linkedin':
      return c.linkedin || null
    case 'github':
      return c.github || null
    case 'website':
      return c.website || c.github || null
    case 'coverLetter':
      return packet.coverLetter || null
    case 'question':
      return matchAnswer(text, packet.answers)
    default:
      return null
  }
}

// ---------- the DOM part (runs in the page, inside the extension) ----------

function describe(el: HTMLInputElement | HTMLTextAreaElement): string {
  const doc = el.ownerDocument
  const bits: string[] = []
  for (const l of Array.from(el.labels ?? [])) bits.push(l.innerText || l.textContent || '')
  const by = el.getAttribute('aria-labelledby')
  if (by) for (const id of by.split(/\s+/)) bits.push(doc.getElementById(id)?.textContent ?? '')
  bits.push(el.getAttribute('aria-label') ?? '', el.getAttribute('placeholder') ?? '', el.name ?? '', el.id ?? '')
  // Forms that put the question in a nearby element, not a <label>.
  if (!bits.join('').trim() || (el.tagName === 'TEXTAREA' && !(el.labels ?? []).length)) {
    const box = el.closest('fieldset, .field, .form-group, .application-question, li, [class*="question"], [class*="field"]')
    const legend = box?.querySelector('legend, label, .text, .application-label, h3, h4, p')
    if (legend) bits.push(legend.textContent ?? '')
  }
  return bits.join(' ').replace(/\s+/g, ' ').trim()
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // React and friends watch the native setter, not .value assignments.
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function mark(el: HTMLElement) {
  el.style.outline = '2px solid #d9734e'
  el.style.outlineOffset = '1px'
  el.setAttribute('data-rework-filled', '1')
}

function attachResume(input: HTMLInputElement, file: NonNullable<ApplyPacket['resume']>): boolean {
  try {
    const bytes = Uint8Array.from(atob(file.base64), (ch) => ch.charCodeAt(0))
    const dt = new DataTransfer()
    dt.items.add(new File([bytes], file.name, { type: file.type }))
    input.files = dt.files
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  } catch {
    return false
  }
}

export interface FillResult {
  filled: string[]
  skipped: number
}

export function fillPage(doc: Document, packet: ApplyPacket): FillResult {
  const filled: string[] = []
  let skipped = 0
  let resumeDone = false
  const fields = Array.from(doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))
  for (const el of fields) {
    const style = doc.defaultView?.getComputedStyle(el)
    const isFile = el instanceof HTMLInputElement && el.type === 'file'
    // File inputs are often visually hidden behind a styled button; everything else must show.
    if (!isFile && (el.disabled || el.readOnly || style?.display === 'none' || style?.visibility === 'hidden')) continue
    const text = describe(el)
    const kind = fieldKind({ text, tag: el.tagName === 'TEXTAREA' ? 'textarea' : 'input', type: (el as HTMLInputElement).type ?? 'textarea', autocomplete: el.getAttribute('autocomplete') ?? '' })
    if (!kind) continue
    if (kind === 'resumeFile') {
      if (!resumeDone && packet.resume && (el as HTMLInputElement).files?.length === 0 && attachResume(el as HTMLInputElement, packet.resume)) {
        resumeDone = true
        filled.push('resume')
      }
      continue
    }
    if (el.value.trim()) continue
    const value = valueFor(kind, packet, text)
    if (!value) {
      if (kind === 'question') skipped++
      continue
    }
    setValue(el, value)
    mark(el)
    filled.push(kind)
  }
  return { filled, skipped }
}

/** The banner on the page after filling. Never a submit button: the person submits. */
export function showBanner(doc: Document, result: FillResult) {
  doc.getElementById('rework-apply-banner')?.remove()
  const bar = doc.createElement('div')
  bar.id = 'rework-apply-banner'
  bar.setAttribute('role', 'status')
  bar.style.cssText =
    'position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:340px;padding:14px 16px;border-radius:14px;background:#14261d;color:#f6f3ee;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)'
  const n = result.filled.length
  const what = n
    ? `Filled ${n} field${n === 1 ? '' : 's'}${result.filled.includes('resume') ? ', including your tailored resume' : ''}.`
    : "Couldn't find fields to fill here. If the form is on the next page, open it and click ReWork again."
  const more = result.skipped === 1 ? ' 1 question needs your own answer.' : result.skipped > 1 ? ` ${result.skipped} questions need your own answer.` : ''
  bar.textContent = `ReWork: ${what}${more} Check everything (filled fields are outlined), answer the rest, then submit it yourself.`
  const close = doc.createElement('button')
  close.textContent = 'OK'
  close.style.cssText = 'margin-left:8px;padding:2px 10px;border-radius:999px;border:1px solid #f6f3ee55;background:transparent;color:inherit;cursor:pointer'
  close.onclick = () => bar.remove()
  bar.appendChild(close)
  doc.body.appendChild(bar)
}
