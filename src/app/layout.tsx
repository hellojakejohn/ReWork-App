import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { OG_DEFAULTS, SITE_URL, TWITTER_DEFAULTS } from '@/lib/site'
import { THEME_SCRIPT } from '@/lib/theme'

const inter = Inter({ subsets: ['latin'] })

const TITLE = 'ReWork: tailor your resume to any job. Nothing made up.'
const DESCRIPTION = 'Upload your resume, paste a job link, get a tailored resume and cover letter. Every rewrite is fact-checked against your real resume.'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1A13' },
  ],
}

export const metadata: Metadata = {
  title: { default: TITLE, template: '%s · ReWork' },
  description: DESCRIPTION,
  applicationName: 'ReWork',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}