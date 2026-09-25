// Last resolver: the model reads a page's meta + main text and pulls out the job fields.
// Server only.
import { getOpenAI } from '@/lib/openai'
import type { PageMeta } from './html-text'
import { cleanLines } from './html-text'
import type { ResolvedJob } from './types'

const MAX_PAGE_CHARS = 14_000

const SCHEMA = {
  type: 'object',
  properties: {
    isJobPosting: { type: 'boolean', description: 'False if the page is not a single job posting (search results, a homepage, an error page).' },
    title: { type: 'string' },
    company: { type: 'string' },
    location: { type: 'string', description: 'As written, e.g. "Minneapolis, MN" or "Remote (US)". Empty if not stated.' },
    description: {
      type: 'string',
      description:
        'The job description copied verbatim from the page: about the role, responsibilities, requirements, nice-to-haves, pay and benefits. One item per line, list items prefixed with "• ". Leave out navigation, cookie banners, EEO/legal text and "apply" buttons.',
    },
  },
  required: ['isJobPosting', 'title', 'company', 'location', 'description'],
  additionalProperties: false,
}

export function jobExtractModel(): string {
  return process.env.OPENAI_JOB_MODEL || 'gpt-4o-mini'
}

export async function extractJobWithModel(meta: PageMeta, url: string): Promise<Omit<ResolvedJob, 'url' | 'source'> | null> {
  const completion = await getOpenAI().chat.completions.create({
    model: jobExtractModel(),
    temperature: 0,
    max_tokens: 4000,
    response_format: { type: 'json_schema', json_schema: { name: 'job_posting', strict: true, schema: SCHEMA } },
    messages: [
      { role: 'system', content: 'You extract job postings from web pages. Copy text exactly; never write or summarize.' },
      {
        role: 'user',
        content: `URL: ${url}
Page title: ${meta.title}
og:title: ${meta.ogTitle}
og:site_name: ${meta.siteName}
Meta description: ${meta.description}

Page text:
${meta.mainText.slice(0, MAX_PAGE_CHARS)}`,
      },
    ],
  })
  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('Empty model response')
  const data = JSON.parse(content) as { isJobPosting: boolean; title: string; company: string; location: string; description: string }
  if (!data.isJobPosting || !data.title.trim() || data.description.trim().length < 50) return null
  return {
    title: data.title.trim(),
    company: data.company.trim() || meta.siteName,
    location: data.location.trim(),
    description: cleanLines(data.description),
  }
}
