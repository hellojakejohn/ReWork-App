import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { ROLES } from '@/lib/role-pages'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/fit`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/check`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/jobs`, changeFrequency: 'daily', priority: 0.8 },
    ...ROLES.map((r) => ({ url: `${SITE_URL}/jobs/${r.slug}`, changeFrequency: 'daily' as const, priority: 0.7 })),
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/proof`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/save`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
