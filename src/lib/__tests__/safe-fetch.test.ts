import http from 'node:http'
import net from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  FetchTimeoutError,
  ResponseTooLargeError,
  UnsafeUrlError,
  assertSafeUrl,
  isPublicAddress,
  safeFetch,
  safeLookup,
} from '@/lib/safe-fetch'

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd00:ec2::254',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:169.254.169.254',
    '64:ff9b::a9fe:a9fe', // NAT64 of 169.254.169.254
    '2002:7f00:1::', // 6to4 of 127.0.0.1
  ])('blocks %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false)
  })

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('allows %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(true)
  })

  it('rejects non-IPs', () => {
    expect(isPublicAddress('example.com')).toBe(false)
  })
})

describe('assertSafeUrl', () => {
  it.each([
    'file:///etc/passwd',
    'ftp://example.com/',
    'gopher://example.com/',
    'http://127.0.0.1/',
    'http://2130706433/', // decimal 127.0.0.1, normalized by URL
    'http://0x7f.1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:3000/',
    'http://metadata.google.internal/',
    'http://user:pass@example.com/',
  ])('rejects %s', (url) => {
    expect(() => assertSafeUrl(url)).toThrow(UnsafeUrlError)
  })

  it('accepts a normal https URL', () => {
    expect(assertSafeUrl('https://jobs.example.com/posting/1').hostname).toBe('jobs.example.com')
  })
})

describe('safeLookup (connect-time check)', () => {
  it('refuses a hostname that resolves to loopback', async () => {
    const err = await new Promise<Error | null>((resolve) => safeLookup('localhost', {}, (e) => resolve(e)))
    expect(err).toBeInstanceOf(UnsafeUrlError)
  })
})

describe('safeFetch limits (local server, blocklist stubbed)', () => {
  let server: http.Server
  let base = ''

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const m = req.url!.match(/^\/redirect\/(\d+)$/)
      if (m) {
        const n = Number(m[1])
        res.writeHead(302, { location: n > 0 ? `/redirect/${n - 1}` : '/ok' })
        return res.end()
      }
      if (req.url === '/ok') return res.end('hello')
      if (req.url === '/big') {
        res.writeHead(200) // no content-length: forces the streaming cap
        return res.end(Buffer.alloc(3 * 1024 * 1024, 97))
      }
      if (req.url === '/slow') return setTimeout(() => res.end('late'), 2000)
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

  it('follows up to 3 redirects', async () => {
    const res = await safeFetch(`${base}/redirect/2`)
    expect(res.text).toBe('hello')
    expect(res.url).toBe(`${base}/ok`)
  })

  it('rejects a 4th redirect', async () => {
    await expect(safeFetch(`${base}/redirect/3`)).rejects.toThrow('Too many redirects')
  })

  it('caps the body', async () => {
    await expect(safeFetch(`${base}/big`)).rejects.toThrow(ResponseTooLargeError)
  })

  it('times out', async () => {
    await expect(safeFetch(`${base}/slow`, { timeoutMs: 200 })).rejects.toThrow(FetchTimeoutError)
  })
})
