import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ReWork — smart tech, for smarter jobs',
  description: 'Transform your resume in seconds with AI-powered optimization. 3 free resumes per month.',
  keywords: 'resume, AI, job application, optimization, career, employment, resume builder, ATS, job search, career tools',
  authors: [{ name: 'ReWork' }],
  creator: 'ReWork',
  publisher: 'ReWork',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://rework.hellojakejohn.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'ReWork — smart tech, for smarter jobs',
    description: 'Transform your resume in seconds with AI-powered optimization. 3 free resumes per month.',
    url: '/',
    siteName: 'ReWork',
    images: [
      {
        url: 'https://rework.hellojakejohn.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ReWork — smart tech, for smarter jobs',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReWork — smart tech, for smarter jobs',
    description: 'Transform your resume in seconds with AI-powered optimization. 3 free resumes per month.',
    images: ['https://rework.hellojakejohn.com/og-image.png'],
    creator: '@rework_app',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/rework-logo-simple-cropped.png', sizes: '64x64', type: 'image/png' },
      { url: '/rework-logo-simple-cropped.png', sizes: '32x32', type: 'image/png' },
      { url: '/rework-logo-simple-cropped.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/rework-logo-simple-cropped.png',
    apple: [
      { url: '/rework-logo-simple-cropped.png', sizes: '180x180', type: 'image/png' },
      { url: '/rework-logo-simple-cropped.png', sizes: '152x152', type: 'image/png' },
      { url: '/rework-logo-simple-cropped.png', sizes: '120x120', type: 'image/png' },
    ],
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/rework-logo-simple-cropped.png',
    },
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
        <Providers>
          {children}
          <Toaster
            position="top-center"
            richColors
            theme="dark"
            expand={false}
            closeButton
            offset={20}
          />
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}