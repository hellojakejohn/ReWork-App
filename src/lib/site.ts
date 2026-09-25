// Canonical origin for metadata, sitemap and robots. NEXTAUTH_URL is the deployed URL.
export const SITE_URL = (process.env.NEXTAUTH_URL || 'https://rework.hellojakejohn.com').replace(/\/$/, '')

// Next merges metadata shallowly: a page that sets openGraph/twitter replaces the
// layout's, images included. Pages spread these in.
export const OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'ReWork: tailor your resume to any job in under a minute. Nothing made up.',
}
export const OG_DEFAULTS = { siteName: 'ReWork', locale: 'en_US', type: 'website' as const, images: [OG_IMAGE] }
export const TWITTER_DEFAULTS = { card: 'summary_large_image' as const, images: [OG_IMAGE.url] }
