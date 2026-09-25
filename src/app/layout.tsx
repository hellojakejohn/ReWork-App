import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { OG_DEFAULTS, SITE_URL, TWITTER_DEFAULTS } from '@/lib/site'

const inter = Inter({ subsets: ['latin'] })

const TITLE = 'ReWork: tailor your resume to any job. Nothing made up.'
const DESCRIPTION = 'Upload your resume, paste a job link, get a tailored resume and cover letter. Every rewrite is fact-checked against your real resume.'

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
  icons: {
    icon: [{ url: '/rework-logo-simple-cropped.png', type: 'image/png' }],
    apple: [{ url: '/rework-logo-simple-cropped.png' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}