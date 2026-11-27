// The emails themselves: plain HTML with inline styles and tables (what every mail app
// renders), plus a text version. Pure functions, no env, no DB: tests and the /admin
// preview call them directly. Never the resume text: jobs, fit numbers and skills only.

import { ADZUNA_HOME, ADZUNA_LABEL, ADZUNA_LABEL_MIN } from '@/lib/feed/adzuna-label'

const C = {
  paper: '#FBFAF7',
  card: '#FFFFFF',
  forest: '#17301F',
  muted: '#4F6656',
  faint: '#6C7F72',
  border: '#E4E6E1',
  accent: '#C23D22',
  tape: '#F7ECC4',
  sage: '#DCE8DE',
}
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export interface Footer {
  siteUrl: string
  unsubscribeUrl: string
  /** Empty for people without an account (free-tool leads): no settings link. */
  settingsUrl: string
  mailingAddress: string
  /** One line on why this person gets this email. */
  why: string
}

export interface EmailContent {
  subject: string
  preheader: string
  html: string
  text: string
}

function shell(preheader: string, body: string, f: Footer): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>ReWork</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 16px;font-family:${SERIF};font-size:22px;color:${C.forest};"><a href="${esc(f.siteUrl)}" style="color:${C.forest};text-decoration:none;"><span style="color:#8FA295;">re</span>work</a></td></tr>
${body}
<tr><td style="padding:24px 4px 0;font-family:${SANS};font-size:12px;line-height:18px;color:${C.faint};">
${esc(f.why)}<br>
<a href="${esc(f.unsubscribeUrl)}" style="color:${C.faint};">Unsubscribe</a> &middot; ${f.settingsUrl ? `<a href="${esc(f.settingsUrl)}" style="color:${C.faint};">Email settings</a> &middot; ` : ''}<a href="mailto:support@rework.careers" style="color:${C.faint};">support@rework.careers</a><br>
ReWork &middot; ${esc(f.mailingAddress)}
</td></tr>
</table></td></tr></table></body></html>`
}

function textFooter(f: Footer): string {
  return `\n--\n${f.why}\nUnsubscribe: ${f.unsubscribeUrl}\n${f.settingsUrl ? `Email settings: ${f.settingsUrl}\n` : ''}ReWork, ${f.mailingAddress}\n`
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${C.forest};border-radius:999px;"><a href="${esc(href)}" style="display:inline-block;padding:10px 18px;font-family:${SANS};font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">${esc(label)}</a></td></tr></table>`
}

/** The fit as a cloth tape: a filled share of a tan strip, the percent beside it. */
function tape(score: number): string {
  const s = Math.max(0, Math.min(100, Math.round(score)))
  const fill = s === 0 ? '' : `<td width="${s}%" style="background:${C.forest};height:8px;font-size:0;line-height:0;">&nbsp;</td>`
  const rest = s === 100 ? '' : `<td style="background:${C.tape};height:8px;font-size:0;line-height:0;">&nbsp;</td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:4px;overflow:hidden;"><tr>${fill}${rest}</tr></table></td>
<td width="44" align="right" style="font-family:${SERIF};font-size:18px;color:${C.forest};white-space:nowrap;">${s}%</td>
</tr></table>`
}

// ---------- weekly "Your measurements" ----------

export interface WeeklyJob {
  title: string
  company: string
  location: string
  remote: boolean
  payLabel: string | null
  /** An Adzuna ad: shows their linked label (their terms). */
  adzuna?: boolean
  /** Exact-words Job match, 0-100. */
  score: number
  /** What a tailor can honestly reach (exact plus "in other words"). */
  reach: number
  /** Job keywords the resume already shows, most important first. */
  present: string[]
  /** Opens this job on the Job card, ready to tailor. */
  tailorUrl: string
}

export interface WeeklyData {
  /** The daily brief says "today" and "since yesterday" instead of "this week". */
  daily?: boolean
  firstName: string | null
  jobs: WeeklyJob[]
  /** Open jobs we checked, for the opening line. */
  checked: number
  followUpsDue: number
  trackerUrl: string
  dashboardUrl: string
  /** The skill missing from the most of their open matches (src/lib/skill-demand.ts). */
  topGap?: { skill: string; jobs: number; of: number } | null
}

const place = (j: WeeklyJob) => (j.remote && !/remote/i.test(j.location) ? `${j.location ? `${j.location}, ` : ''}Remote` : j.location)
const roundDown = (n: number) => (n >= 10_000 ? `${Math.floor(n / 1000).toLocaleString('en-US')},000` : n.toLocaleString('en-US'))

export function weeklySubject(count: number, daily = false): string {
  return `Your measurements ${daily ? 'today' : 'this week'}: ${count} new ${count === 1 ? 'job' : 'jobs'} that fit`
}

/** Adzuna's required label: the word Adzuna, at least 116 x 23 px, linked to their site. */
function adzunaLabel(): string {
  return `<div style="padding:0 0 12px;"><a href="${ADZUNA_HOME}" style="display:inline-block;min-width:${ADZUNA_LABEL_MIN.width}px;line-height:${ADZUNA_LABEL_MIN.height}px;padding:0 8px;border:1px solid ${C.border};border-radius:4px;text-align:center;font-family:${SANS};font-size:12px;color:${C.forest};text-decoration:none;">${ADZUNA_LABEL}</a></div>`
}

export function weeklyEmail(d: WeeklyData, f: Footer): EmailContent {
  const n = d.jobs.length
  const subject = weeklySubject(n, d.daily)
  const top = d.jobs[0]
  const preheader = top ? `${top.title} at ${top.company}, ${top.score}% match, and ${n - 1} more.`.replace(', and 0 more.', '.') : 'New jobs that fit your resume.'
  const hello = d.firstName ? `Hi ${d.firstName},` : 'Hi,'
  const intro = `We checked ${roundDown(d.checked)} open jobs against your resume. These are the best new ones ${d.daily ? 'since yesterday' : 'this week'}.`

  const cards = d.jobs
    .map((j) => {
      const meta = [j.company, place(j), j.payLabel].filter(Boolean).map((s) => esc(String(s))).join(' &middot; ')
      const skills = j.present.slice(0, 4)
      const lift = j.reach >= j.score + 5 ? `<div style="padding-top:4px;font-family:${SANS};font-size:12px;color:${C.muted};">Tailoring can lift this to ${j.reach}%.</div>` : ''
      return `<tr><td style="padding:0 0 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;"><tr><td style="padding:16px;">
<div style="font-family:${SERIF};font-size:18px;line-height:24px;color:${C.forest};">${esc(j.title)}</div>
<div style="padding:2px 0 12px;font-family:${SANS};font-size:13px;color:${C.muted};">${meta}</div>
${j.adzuna ? adzunaLabel() : ''}${tape(j.score)}${lift}
${skills.length ? `<div style="padding:10px 0 12px;font-family:${SANS};font-size:12px;color:${C.muted};">You already show: ${skills.map((s) => `<span style="display:inline-block;background:${C.sage};color:${C.forest};border-radius:999px;padding:2px 8px;margin:2px 2px 0 0;">${esc(s)}</span>`).join('')}</div>` : '<div style="height:12px;"></div>'}
${button(j.tailorUrl, 'Tailor for this job')}
</td></tr></table></td></tr>`
    })
    .join('\n')

  const followUps =
    d.followUpsDue > 0
      ? `<tr><td style="padding:4px 4px 12px;font-family:${SANS};font-size:14px;color:${C.forest};"><strong>${d.followUpsDue} follow-up${d.followUpsDue === 1 ? '' : 's'} due.</strong> <a href="${esc(d.trackerUrl)}" style="color:${C.accent};">Open your tracker</a></td></tr>`
      : ''

  const gapLine = d.topGap ? `${d.topGap.skill} would open the most doors: ${d.topGap.jobs} of your ${d.topGap.of} matches ask for it.` : ''
  const gap = gapLine
    ? `<tr><td style="padding:4px 4px 12px;font-family:${SANS};font-size:14px;line-height:21px;color:${C.forest};"><strong>${esc(gapLine)}</strong> <a href="${esc(d.dashboardUrl)}" style="color:${C.accent};">See what it would take</a></td></tr>`
    : ''

  const body = `<tr><td style="padding:0 4px 16px;font-family:${SANS};font-size:15px;line-height:22px;color:${C.forest};">${esc(hello)}<br>${esc(intro)}</td></tr>
${followUps}
${cards}
${gap}
<tr><td style="padding:4px 4px 0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted};">The % is how many of the job's own words your resume already uses. Every tailor is checked against your resume: nothing invented. <a href="${esc(d.dashboardUrl)}" style="color:${C.accent};">See all your matches</a></td></tr>`

  const text =
    `${hello}\n${intro}\n\n` +
    (d.followUpsDue > 0 ? `${d.followUpsDue} follow-up${d.followUpsDue === 1 ? '' : 's'} due: ${d.trackerUrl}\n\n` : '') +
    d.jobs
      .map((j) => `${j.title}\n${[j.company, place(j), j.payLabel].filter(Boolean).join(' / ')}\nMatch: ${j.score}%${j.present.length ? ` (you show ${j.present.slice(0, 4).join(', ')})` : ''}\nTailor for this job: ${j.tailorUrl}\n`)
      .join('\n') +
    (gapLine ? `\n${gapLine} See what it would take: ${d.dashboardUrl}\n` : '') +
    `\nSee all your matches: ${d.dashboardUrl}\n` +
    textFooter(f)

  return { subject, preheader, html: shell(preheader, body, f), text }
}

// ---------- welcome ----------

export interface WelcomeData {
  firstName: string | null
  dashboardUrl: string
  freeTailors: number
}

export function welcomeEmail(d: WelcomeData, f: Footer): EmailContent {
  const subject = 'Welcome to ReWork'
  const preheader = 'Your first tailored resume takes about a minute.'
  const hello = d.firstName ? `Hi ${d.firstName},` : 'Hi,'
  const steps = [
    ['Upload your resume once.', 'PDF, Word or pasted text. You check what we read before anything else happens.'],
    ['Paste a job link.', "Or pick one of the jobs we found for you. You'll see how well you fit before you spend a tailor."],
    ['Get a tailored resume and cover letter.', 'Every line is checked against your resume: no invented employers, tools, numbers or titles.'],
  ]
  const body = `<tr><td style="padding:0 4px 16px;font-family:${SANS};font-size:15px;line-height:22px;color:${C.forest};">${esc(hello)}<br>Thanks for trying ReWork. Here's the whole thing in three steps:</td></tr>
<tr><td style="padding:0 0 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;"><tr><td style="padding:16px;">
${steps
  .map(
    ([h, p], i) =>
      `<div style="padding:${i ? '12px' : '0'} 0 0;font-family:${SANS};font-size:14px;line-height:21px;color:${C.forest};"><strong>${i + 1}. ${esc(h)}</strong><br><span style="color:${C.muted};">${esc(p)}</span></div>`
  )
  .join('\n')}
<div style="height:16px;"></div>${button(d.dashboardUrl, 'Start with your resume')}
</td></tr></table></td></tr>
<tr><td style="padding:0 4px;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted};">Free covers ${d.freeTailors} tailors a month. On Mondays we'll email you the best new jobs for your resume; turn that off any time below. Questions or something broke? Just reply.<br><br>Jake, who builds ReWork</td></tr>`
  const text =
    `${hello}\nThanks for trying ReWork. Here's the whole thing in three steps:\n\n` +
    steps.map(([h, p], i) => `${i + 1}. ${h} ${p}`).join('\n') +
    `\n\nStart with your resume: ${d.dashboardUrl}\n\nFree covers ${d.freeTailors} tailors a month. On Mondays we'll email you the best new jobs for your resume; turn that off any time. Questions or something broke? Just reply.\n\nJake, who builds ReWork\n` +
    textFooter(f)
  return { subject, preheader, html: shell(preheader, body, f), text }
}

// ---------- free-tool leads (src/lib/leads.ts) ----------

/** The ghost-job red flags checklist promised on /check. Plain facts, no verdicts. */
export const GHOST_CHECKLIST: [string, string][] = [
  ['It is not on the employer\'s own careers page.', 'Search the company site for the title. If it is only on job boards, ask the recruiter for the direct link.'],
  ['It was posted 30+ days ago.', 'Older ads are more often filled, paused or left up by mistake. Apply, but do not wait on it.'],
  ['It keeps getting reposted.', 'Some roles are reposted for months without a hire. A note to the hiring team helps you find out.'],
  ['It talks about "future openings" or a "talent pool".', 'There may be no open role right now, just a list of candidates.'],
  ['The employer is not named.', 'Recruiting agencies often post this way. Ask who the client is before you send your resume.'],
  ['No pay range is listed.', 'It is fair to ask for the range before you interview.'],
  ['Hundreds of people already applied.', 'Apply early, and pair it with a referral or a short note to the hiring manager.'],
]
export const SCAM_CHECKLIST: string[] = [
  'They ask you to pay for training, equipment or a background check.',
  'They move you to a chat app (Telegram, WhatsApp, Signal) for the "interview".',
  'They send a check and ask you to send part of it back.',
  'They ask for your SSN or bank details before an offer in writing.',
  'They ask you to run code from their repo as a "test".',
]

export interface LeadCheckData {
  checkUrl: string
  signupUrl: string
}

export function leadCheckEmail(d: LeadCheckData, f: Footer): EmailContent {
  const subject = 'Your ghost-job red flags checklist'
  const preheader = 'Seven signs a job ad may not lead to a hire, and five that mean walk away.'
  const ghost = GHOST_CHECKLIST.map(
    ([h, p], i) =>
      `<div style="padding:${i ? '12px' : '0'} 0 0;font-family:${SANS};font-size:14px;line-height:21px;color:${C.forest};"><strong>${esc(h)}</strong><br><span style="color:${C.muted};">${esc(p)}</span></div>`
  ).join('\n')
  const scam = SCAM_CHECKLIST.map((x) => `<li style="padding:0 0 6px;">${esc(x)}</li>`).join('')
  const body = `<tr><td style="padding:0 4px 16px;font-family:${SANS};font-size:15px;line-height:22px;color:${C.forest};">Here's the checklist you asked for. Keep it handy before you spend an evening on an application.</td></tr>
<tr><td style="padding:0 0 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;"><tr><td style="padding:16px;">
<div style="font-family:${SERIF};font-size:18px;color:${C.forest};padding:0 0 10px;">Ghost-job signs</div>
${ghost}
</td></tr></table></td></tr>
<tr><td style="padding:0 0 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;"><tr><td style="padding:16px;font-family:${SANS};font-size:14px;line-height:21px;color:${C.forest};">
<div style="font-family:${SERIF};font-size:18px;color:${C.accent};padding:0 0 10px;">Scam signs: walk away</div>
<ul style="margin:0;padding:0 0 0 18px;">${scam}</ul>
</td></tr></table></td></tr>
<tr><td style="padding:0 4px 16px;">${button(d.checkUrl, 'Check another job')}</td></tr>
<tr><td style="padding:0 4px;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted};">We'll write when we add a new check. Found a real one worth applying to? ReWork tailors your resume to it from your real experience only: <a href="${esc(d.signupUrl)}" style="color:${C.forest};">try it free</a>.<br><br>Jake, who builds ReWork</td></tr>`
  const text =
    `Here's the checklist you asked for.\n\nGhost-job signs\n` +
    GHOST_CHECKLIST.map(([h, p]) => `- ${h} ${p}`).join('\n') +
    `\n\nScam signs: walk away\n` +
    SCAM_CHECKLIST.map((x) => `- ${x}`).join('\n') +
    `\n\nCheck another job: ${d.checkUrl}\n\nWe'll write when we add a new check. Found a real one? ReWork tailors your resume to it from your real experience only: ${d.signupUrl}\n\nJake, who builds ReWork\n` +
    textFooter(f)
  return { subject, preheader, html: shell(preheader, body, f), text }
}

export interface LeadFitTip {
  skill: string
  time: string
  learn: string
  build: string
}

export interface LeadFitData {
  missing: string[]
  tips: LeadFitTip[]
  fitUrl: string
  signupUrl: string
}

export function leadFitEmail(d: LeadFitData, f: Footer): EmailContent {
  const subject = d.missing.length ? `Your ${d.missing.length} missing keyword${d.missing.length === 1 ? '' : 's'}` : 'Your fit check keywords'
  const preheader = 'What the job asks for that your resume does not show yet, and how to close the gap.'
  const chips = d.missing.length
    ? d.missing.map((w) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border:1px dashed ${C.accent};border-radius:999px;font-family:${SANS};font-size:13px;color:${C.forest};">${esc(w)}</span>`).join('')
    : `<span style="font-family:${SANS};font-size:14px;color:${C.muted};">None. Your resume already shows every keyword we found.</span>`
  const tips = d.tips
    .map(
      (t, i) =>
        `<div style="padding:${i ? '14px' : '0'} 0 0;font-family:${SANS};font-size:14px;line-height:21px;color:${C.forest};"><strong>${esc(t.skill)}</strong> <span style="color:${C.faint};">(${esc(t.time)})</span><br><span style="color:${C.muted};">Learn: ${esc(t.learn)}<br>Build: ${esc(t.build)}</span></div>`
    )
    .join('\n')
  const body = `<tr><td style="padding:0 4px 16px;font-family:${SANS};font-size:15px;line-height:22px;color:${C.forest};">Here are the keywords from the job that your resume doesn't show yet. If you already have one of these, say it in the job's own words. If you don't, the tips below are a start.</td></tr>
<tr><td style="padding:0 0 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;"><tr><td style="padding:16px;">
<div style="font-family:${SERIF};font-size:18px;color:${C.forest};padding:0 0 10px;">Needs alterations</div>
${chips}
</td></tr></table></td></tr>
${
  tips
    ? `<tr><td style="padding:0 0 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;"><tr><td style="padding:16px;">
<div style="font-family:${SERIF};font-size:18px;color:${C.forest};padding:0 0 10px;">Close the gap</div>
${tips}
</td></tr></table></td></tr>`
    : ''
}
<tr><td style="padding:0 4px 16px;">${button(d.signupUrl, 'Tailor my resume free')}</td></tr>
<tr><td style="padding:0 4px;font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted};">Same you. Better fit. ReWork rewrites your resume in the job's words from your real experience only, and never adds a skill you don't have. <a href="${esc(d.fitUrl)}" style="color:${C.forest};">Measure another job</a>.<br><br>Jake, who builds ReWork</td></tr>`
  const text =
    `Here are the keywords from the job that your resume doesn't show yet.\n\nNeeds alterations: ${d.missing.join(', ') || 'none'}\n` +
    (d.tips.length ? `\nClose the gap\n` + d.tips.map((t) => `- ${t.skill} (${t.time}). Learn: ${t.learn} Build: ${t.build}`).join('\n') + '\n' : '') +
    `\nTailor my resume free: ${d.signupUrl}\nMeasure another job: ${d.fitUrl}\n\nJake, who builds ReWork\n` +
    textFooter(f)
  return { subject, preheader, html: shell(preheader, body, f), text }
}
