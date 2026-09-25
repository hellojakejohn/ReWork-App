// SSRF-safe fetch for user-supplied URLs (server only).
//
// - http(s) only, no credentials in the URL
// - every resolved IP is checked at connect time via a custom `lookup`, so a hostname
//   can't pass validation and then re-resolve to 127.0.0.1 (DNS rebinding)
// - private, loopback, link-local, CGNAT, metadata, multicast and reserved ranges rejected (v4 + v6)
// - redirects followed manually (max 3), each hop re-validated
// - one overall timeout, and a cap on the (decompressed) body size
import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'
import zlib from 'node:zlib'
import type { Readable } from 'node:stream'

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}
export class FetchTimeoutError extends Error {
  constructor() {
    super('Request timed out')
    this.name = 'FetchTimeoutError'
  }
}
export class ResponseTooLargeError extends Error {
  constructor() {
    super('Response too large')
    this.name = 'ResponseTooLargeError'
  }
}

const blocked = new net.BlockList()
// IPv4
for (const [net4, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. 169.254.169.254 cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
] as const) {
  blocked.addSubnet(net4, prefix, 'ipv4')
}
// IPv6
for (const [net6, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // unique local (incl. fd00:ec2::254 AWS metadata)
  ['fe80::', 10], // link-local
  ['fec0::', 10], // deprecated site-local
  ['ff00::', 8], // multicast
] as const) {
  blocked.addSubnet(net6, prefix, 'ipv6')
}

function expandIPv6(ip: string): number[] | null {
  // 8 x 16-bit groups. Handles "::" and a trailing dotted IPv4 ("::ffff:1.2.3.4").
  let s = ip.toLowerCase().split('%')[0]
  const dotted = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    if (!net.isIPv4(dotted[2])) return null
    const o = dotted[2].split('.').map(Number)
    s = `${dotted[1]}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`
  }
  const parts = s.split('::')
  if (parts.length > 2) return null
  const parse = (p: string) => (p ? p.split(':').map((h) => parseInt(h, 16)) : [])
  const head = parse(parts[0])
  if (parts.length === 1) return head.length === 8 ? head : null
  const tail = parse(parts[1])
  const zeros = 8 - head.length - tail.length
  if (zeros < 0) return null
  return [...head, ...Array(zeros).fill(0), ...tail]
}

/** IPv4 embedded in an IPv6 address we'd otherwise route to (mapped, compat, NAT64, 6to4). */
function embeddedIPv4(ip: string): string | null {
  const g = expandIPv6(ip)
  if (!g) return null
  const v4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  const zeroPrefix = (n: number) => g.slice(0, n).every((x) => x === 0)
  if (zeroPrefix(5) && g[5] === 0xffff) return v4(g[6], g[7]) // ::ffff:a.b.c.d
  if (zeroPrefix(6) && (g[6] !== 0 || g[7] > 1)) return v4(g[6], g[7]) // ::a.b.c.d (deprecated compat)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return v4(g[6], g[7]) // NAT64
  if (g[0] === 0x2002) return v4(g[1], g[2]) // 6to4
  return null
}

export function isPublicAddress(ip: string): boolean {
  const family = net.isIP(ip)
  if (family === 4) return !blocked.check(ip, 'ipv4')
  if (family === 6) {
    const inner = embeddedIPv4(ip)
    if (inner && blocked.check(inner, 'ipv4')) return false
    return !blocked.check(ip, 'ipv6')
  }
  return false
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void

export function safeLookup(hostname: string, options: dns.LookupOptions, callback: LookupCb) {
  dns.lookup(hostname, { all: true, family: options.family, hints: options.hints }, (err, addresses) => {
    if (err) return callback(err, '')
    if (!addresses.length) return callback(new UnsafeUrlError(`Could not resolve ${hostname}`), '')
    const bad = addresses.find((a) => !isPublicAddress(a.address))
    if (bad) return callback(new UnsafeUrlError(`${hostname} resolves to a non-public address`), '')
    if (options.all) return callback(null, addresses)
    callback(null, addresses[0].address, addresses[0].family)
  })
}

export function assertSafeUrl(raw: string | URL): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError('Invalid URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('Only http and https URLs are allowed')
  if (url.username || url.password) throw new UnsafeUrlError('URLs with credentials are not allowed')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host) throw new UnsafeUrlError('Invalid URL')
  if (net.isIP(host) && !isPublicAddress(host)) throw new UnsafeUrlError('That address is not allowed')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new UnsafeUrlError('That host is not allowed')
  }
  return url
}

export interface SafeFetchOptions {
  headers?: Record<string, string>
  maxRedirects?: number
  timeoutMs?: number
  maxBytes?: number
}

export interface SafeFetchResponse {
  status: number
  headers: http.IncomingHttpHeaders
  url: string // final URL after redirects
  text: string
}

function decode(res: http.IncomingMessage): Readable {
  switch ((res.headers['content-encoding'] || '').toLowerCase()) {
    case 'gzip':
    case 'x-gzip':
      return res.pipe(zlib.createGunzip())
    case 'deflate':
      return res.pipe(zlib.createInflate())
    case 'br':
      return res.pipe(zlib.createBrotliDecompress())
    default:
      return res
  }
}

function requestOnce(
  url: URL,
  headers: Record<string, string>,
  maxBytes: number,
  signal: AbortSignal
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer | null }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http
    const req = mod.request(
      url,
      { method: 'GET', headers, lookup: safeLookup as unknown as typeof dns.lookup, signal },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          return resolve({ status, headers: res.headers, body: null })
        }
        const declared = Number(res.headers['content-length'])
        if (Number.isFinite(declared) && declared > maxBytes) {
          res.destroy()
          return reject(new ResponseTooLargeError())
        }
        const stream = decode(res)
        const chunks: Buffer[] = []
        let size = 0
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) {
            stream.destroy()
            res.destroy()
            reject(new ResponseTooLargeError())
            return
          }
          chunks.push(chunk)
        })
        stream.on('end', () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }))
        stream.on('error', reject)
      }
    )
    req.on('error', reject)
    req.end()
  })
}

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const maxRedirects = opts.maxRedirects ?? 3
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000)
  const headers = { 'accept-encoding': 'gzip, deflate, br', ...opts.headers }

  try {
    let url = assertSafeUrl(rawUrl)
    for (let hop = 0; ; hop++) {
      const res = await requestOnce(url, headers, maxBytes, controller.signal)
      if (res.body === null) {
        if (hop >= maxRedirects) throw new UnsafeUrlError('Too many redirects')
        url = assertSafeUrl(new URL(String(res.headers.location), url))
        continue
      }
      return { status: res.status, headers: res.headers, url: url.href, text: res.body.toString('utf8') }
    }
  } catch (error) {
    if (controller.signal.aborted) throw new FetchTimeoutError()
    throw error
  } finally {
    clearTimeout(timer)
  }
}
