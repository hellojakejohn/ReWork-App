// Last resolver: the model reads a page's meta + main text and pulls out the job fields.
// Server only.
import { generateStructured, type AICallOptions, callOverrides } from '@/lib/ai'
import { taskRoute } from '@/lib/ai/routing'
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

/** The configured job-extraction model (AI_JOB_EXTRACT, else the default routing). */
export function jobExtractModel(): string {
  return taskRoute('jobExtract').model
}

interface JobPosting {
  isJobPosting: boolean
  title: string
  company: string
  location: string
  description: string
}

export async function extractJobWithModel(meta: PageMeta, url: string, options: AICallOptions = {}): Promise<Omit<ResolvedJob, 'url' | 'source'> | null> {
  const { data } = await generateStructured<JobPosting>({
    task: 'jobExtract',
    system: 'You extract job postings from web pages. Copy text exactly; never write or summarize.',
    schema: SCHEMA,
    schemaName: 'job_posting',
    maxTokens: 4000,
    temperature: 0,
    effort: 'low',
    ...callOverrides('jobExtract', options),
    messages: [
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
  if (!data.isJobPosting || !data.title.trim() || data.description.trim().length < 50) return null
  return {
    title: data.title.trim(),
    company: data.company.trim() || meta.siteName,
    location: data.location.trim(),
    description: cleanLines(data.description),
  }
}
