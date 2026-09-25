// HTML -> readable job description text. Keeps headings, paragraphs and bullets as lines
// ("• " for list items), strips page chrome and legal boilerplate. Never slices text.
import * as cheerio from 'cheerio'

const CHROME = 'script, style, noscript, template, svg, iframe, form, button, nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"]'
const BLOCKS = 'p, div, section, article, main, h1, h2, h3, h4, h5, h6, ul, ol, table, tr, blockquote, pre, dl, dt, dd'

// Whole lines that are page furniture, not job content.
const JUNK_LINE = /^(apply( now| for this job| here)?|back to (jobs|all jobs|search|results)|share( this job)?|save( this)? job|sign in|log ?in|view all (jobs|openings)|similar jobs|report (this )?job|accept( all)? cookies|cookie (settings|preferences|policy)|privacy policy|terms (of (use|service)|and conditions)|all rights reserved.*|©.*|copyright ©?.*|powered by .*|skip to (main )?content|menu|close)$/i

// Legal paragraphs that add nothing to tailoring. Pay-transparency/salary text is kept.
const BOILERPLATE_LINE =
  /(equal (employment )?opportunity|affirmative action employer|without regard to (race|age|sex|religion)|e-verify|reasonable accommodations?\b.*(request|contact|disabilit)|fair chance ordinance|arrest (and|or) conviction records|we use cookies|this site uses cookies|by clicking .* you agree)/i

/** Decode HTML that was entity-escaped once or twice ("&lt;p&gt;" -> "<p>"). */
export function decodeEntities(value: string): string {
  let out = value
  for (let i = 0; i < 2 && /&(lt|gt|amp|quot|#\d+|#x[0-9a-f]+);/i.test(out) && !/<[a-z/][^>]*>/i.test(out); i++) {
    out = cheerio.load(`<textarea>${out}</textarea>`)('textarea').text()
  }
  return out
}

export function cleanLines(text: string, { keepBlankLines = true }: { keepBlankLines?: boolean } = {}): string {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‍﻿]/g, '')
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .map((line) => line.replace(/^[•·▪◦‣∙*-]\s*•\s*/, '• ').replace(/^[·▪◦‣∙]\s+/, '• '))
    .filter((line) => line !== '•')
    .filter((line) => !(line.length < 60 && JUNK_LINE.test(line)))
    .filter((line) => !(line.length > 40 && BOILERPLATE_LINE.test(line)))
  // Collapse runs of blank lines to one.
  const out: string[] = []
  for (const line of lines) {
    if (!line && (!keepBlankLines || out.length === 0 || out[out.length - 1] === '')) continue
    out.push(line)
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out.join('\n')
}

/** Readable text from an HTML fragment or page. `strip` removes nav/header/footer chrome. */
export function htmlToText(html: string, { strip = true }: { strip?: boolean } = {}): string {
  const $ = cheerio.load(decodeEntities(html))
  if (strip) $(CHROME).remove()
  else $('script, style, noscript, template, svg').remove()
  $('br').replaceWith('\n')
  $('li').each((_, el) => {
    $(el).prepend('\n• ').append('\n')
  })
  $(BLOCKS).each((_, el) => {
    $(el).prepend('\n').append('\n')
  })
  const root = $('body').length ? $('body') : $.root()
  // One block per line; callers add blank lines between sections they assemble.
  return cleanLines(root.text(), { keepBlankLines: false })
}

export interface PageMeta {
  title: string
  ogTitle: string
  siteName: string
  description: string
  mainText: string
}

const MAIN_CANDIDATES = [
  '[itemprop="description"]',
  '[class*="job-description" i]',
  '[id*="job-description" i]',
  '[class*="jobdescription" i]',
  '[class*="posting-description" i]',
  '[class*="job-details" i]',
  '[id*="job-details" i]',
  'main',
  'article',
  '[role="main"]',
]

/** OpenGraph/meta tags plus the most likely main content block as text. */
export function extractPageMeta(html: string): PageMeta {
  const $ = cheerio.load(html)
  const meta = (sel: string) => ($(sel).attr('content') || '').trim()
  let mainText = ''
  for (const selector of MAIN_CANDIDATES) {
    const el = $(selector).first()
    if (!el.length) continue
    const text = htmlToText($.html(el))
    if (text.length > 200) {
      mainText = text
      break
    }
  }
  if (!mainText) mainText = htmlToText(html)
  return {
    title: $('title').first().text().trim(),
    ogTitle: meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]'),
    siteName: meta('meta[property="og:site_name"]'),
    description: meta('meta[property="og:description"]') || meta('meta[name="description"]'),
    mainText,
  }
}
