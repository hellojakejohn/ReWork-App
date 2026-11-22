// The one server-side page fetcher for job links: safeFetch (private addresses blocked on
// every hop), LinkedIn refused even through a redirect, small timeouts and size caps.
import { safeFetch } from '@/lib/safe-fetch'
import { refuseLinkedIn, type FetchedPage } from '@/lib/job-resolve'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export async function fetchJobPage(url: string, accept: 'json' | 'html'): Promise<FetchedPage> {
  const res = await safeFetch(url, {
    checkUrl: refuseLinkedIn,
    maxRedirects: 3,
    timeoutMs: 8000,
    maxBytes: 3 * 1024 * 1024,
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: accept === 'json' ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.8',
    },
  })
  return { status: res.status, url: res.url, text: res.text }
}
