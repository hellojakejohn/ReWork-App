import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'rework',
    short_name: 'rework',
    description: 'Tailored to the job. True to you.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#FBFAF7',
    theme_color: '#17301F',
    icons: [
      { src: '/brand/rework-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/rework-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
