// Launch audit: SSRF checks and redirect handling in safeFetch, offline. A local server
// (with the blocklist stubbed only for those tests) stands in for remote hosts; DNS
// answers are mocked to simulate rebinding. it.fails = proven gap.
import dns from 'node:dns'
import http from 'node:http'
import net from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { UnsafeUrlError, assertSafeUrl, isPublicAddress, safeFetch, safeLookup } from '@/lib/safe-fetch'
import { LinkedInUrlError, refuseLinkedIn, resolveJob } from '@/lib/job-resolve'

describe('assertSafeUrl: literal addresses and schemes', () => {
  it.each([
    'http://127.0.0.1/',
    'http://127.1/',
    'http://0/',
    'http://2130706433/', // decimal
    'http://017700000001/', // octal
    'http://0x7f000001/', // hex
    'http://10.0.0.5/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:a9fe:a9fe]/', // mapped 169.254.169.254, hex form
    'http://[0:0:0:0:0:ffff:7f00:1]/',
    'http://[fd00:ec2::254]/',
    'http://[fe80::1%25en0]/',
    'file:///etc/passwd',
    'ftp://example.com/',
    'gopher://127.0.0.1:6379/_x',
    'data:text/html,hi',
    'javascript:alert(1)',
    'http://localhost/',
    'http://LOCALHOST:3000/',
    'http://api.localhost/',
    'http://metadata.google.internal/',
    'http://printer.local/',
    'http://user:pw@example.com/',
  ])('rejects %s', (url) => {
    expect(() => assertSafeUrl(url)).toThrow(UnsafeUrlError)
  })

  it('"localhost." (trailing dot) passes the name check but is refused at connect time', async () => {
    expect(() => assertSafeUrl('http://localhost./')).not.toThrow()
    await expect(safeFetch('http://localhost./')).rejects.toThrow(UnsafeUrlError)
  })

  it('any port on a public host is allowed (Low: no port allowlist)', () => {
    expect(() => assertSafeUrl('http://example.com:6379/')).not.toThrow()
  })

  // Teredo (2001::/32) embeds an IPv4 address; not in the IPv6 blocklist. Low: needs a
  // Teredo relay route from the lambda, which Vercel does not have.
  it('Teredo 2001::/32 is treated as public (known gap, see docs/AUDIT.md)', () => {
    expect(isPublicAddress('2001:0:4136:e378:8000:63bf:3fff:fdd2')).toBe(true)
  })
})

describe('DNS rebinding: names that resolve to private addresses', () => {
  afterEach(() => vi.restoreAllMocks())

  const fakeDns = (addresses: { address: string; family: number }[]) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(dns, 'lookup').mockImplementation(((_h: string, _o: unknown, cb: any) => cb(null, addresses)) as never)

  it.each([
    [[{ address: '127.0.0.1', family: 4 }]],
    [[{ address: '169.254.169.254', family: 4 }]],
    [[{ address: '::ffff:10.0.0.1', family: 6 }]],
    [[{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]], // one bad answer is enough
  ])('safeLookup refuses %j', async (addresses) => {
    fakeDns(addresses)
    const err = await new Promise<Error | null>((resolve) => safeLookup('jobs.evil.example', {}, (e) => resolve(e)))
    expect(err).toBeInstanceOf(UnsafeUrlError)
  })

  it('safeFetch on a hostname that resolves to loopback never connects', async () => {
    fakeDns([{ address: '127.0.0.1', family: 4 }])
    const connect = vi.spyOn(net.Socket.prototype, 'connect')
    await expect(safeFetch('http://jobs.evil.example/')).rejects.toThrow(/non-public/)
    // the socket may be created, but no connect to 127.0.0.1 happens
    expect(connect.mock.calls.some((c) => JSON.stringify(c).includes('127.0.0.1'))).toBe(false)
  })
})

describe('redirects into LinkedIn and private space (local server, blocklist stubbed)', () => {
  let server: http.Server
  let base = ''
  const hits: string[] = []

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      hits.push(req.url!)
      const to: Record<string, string> = {
        '/to-linkedin': 'https://uk.linkedin.com/jobs/view/123',
        '/to-lnkd': 'https://lnkd.in/abc',
        '/to-linkedin-http': 'http://www.linkedin.com/comm/jobs/view/1',
        '/loop': '/loop',
      }
      if (to[req.url!]) {
        res.writeHead(302, { location: to[req.url!] })
        return res.end()
      }
      if (req.url === '/latin1') {
        res.writeHead(200, { 'content-type': 'text/html; charset=iso-8859-1' })
        return res.end(Buffer.from('<p>Développeur</p>', 'latin1'))
      }
      res.writeHead(404).end()
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    vi.spyOn(net.BlockList.prototype, 'check').mockReturnValue(false)
  })

  afterAll(() => {
    vi.restoreAllMocks()
    server.close()
  })

  it.each(['/to-linkedin', '/to-lnkd', '/to-linkedin-http'])('%s: refused before any request to LinkedIn', async (path) => {
    await expect(safeFetch(`${base}${path}`, { checkUrl: refuseLinkedIn })).rejects.toThrow(LinkedInUrlError)
  })

  it('end to end: resolveJob on a short link that redirects to LinkedIn -> needsPaste linkedin', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchPage = async (url: string) => {
      const res = await safeFetch(url, { checkUrl: refuseLinkedIn })
      return { status: res.status, url: res.url, text: res.text }
    }
    expect(await resolveJob(`${base}/to-linkedin`, { fetchPage })).toMatchObject({ ok: false, reason: 'linkedin' })
  })

  it('redirect loop stops after 3 hops', async () => {
    hits.length = 0
    await expect(safeFetch(`${base}/loop`)).rejects.toThrow('Too many redirects')
    expect(hits.length).toBe(4)
  })

  // Correct behavior: honor the charset in Content-Type (or <meta charset>) when decoding.
  // safeFetch always decodes UTF-8, so Latin-1 / Shift_JIS / GBK job pages arrive as
  // mojibake ("D�veloppeur") and are tailored against garbled text.
  it.fails('a Latin-1 page decodes correctly', async () => {
    const res = await safeFetch(`${base}/latin1`)
    expect(res.text).toContain('Développeur')
  })
})
