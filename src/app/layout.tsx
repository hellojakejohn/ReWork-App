import type { Metadata, Viewport } from 'next'
import { Newsreader, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { OG_DEFAULTS, SITE_URL, TWITTER_DEFAULTS } from '@/lib/site'
import { THEME_SCRIPT } from '@/lib/theme'

// Headings and big claims: Newsreader (optical sizes). UI: Plus Jakarta Sans.
// PDF/DOCX exports keep their own fonts (ATS-neutral).
// Variable font (one file covers 500 and 600) so the optical-size axis can load.
const serif = Newsreader({
  subsets: ['latin'],
  style: ['normal'],
  axes: ['opsz'],
  variable: '--font-serif',
  display: 'swap',
})
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const TITLE = 'rework: Tailored to the job. True to you.'
const DESCRIPTION = 'Upload your resume, paste a job link, get a tailored resume and cover letter. Every rewrite is fact-checked against your real resume.'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1A13' },
  ],
}

export const metadata: Metadata = {
  title: { default: TITLE, template: '%s · rework' },
  description: DESCRIPTION,
  applicationName: 'rework',
  authors: [{ name: 'Jakob Johnson' }],
  creator: 'Jakob Johnson',
  formatDetection: { email: false, address: false, telephone: false },
  metadataBase: new URL(SITE_URL),
  openGraph: { ...OG_DEFAULTS, title: TITLE, description: DESCRIPTION },
  twitter: { ...TWITTER_DEFAULTS, title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
  // Icons come from the file conventions: app/favicon.ico, app/icon.svg, app/apple-icon.png.
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // The inline script sets .dark before first paint; suppressHydrationWarning covers
    // the class React didn't render.
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}