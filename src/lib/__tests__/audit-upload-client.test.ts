// Launch audit: what the browser-side API helpers show when the platform (not our route)
// answers, e.g. Vercel's own 413/504 HTML pages. fetch is mocked; no network.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchJobFromUrl, parseResumeInput } from '@/components/flow/api'

const html = (status: number, body = '<!DOCTYPE html><html><body>Request Entity Too Large</body></html>') =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

const ndjson = (lines: string) => new Response(lines, { status: 200, headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } })

afterEach(() => vi.unstubAllGlobals())

describe('parseResumeInput', () => {
  it('Vercel 413 HTML page -> our 413 copy, never "Unexpected token <"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => html(413)))
    const result = await parseResumeInput(new File([new Uint8Array(10)], 'r.pdf'), () => {})
    expect(result).toMatchObject({ ok: false, status: 413, error: "That's too large to send. Try a smaller file, or paste the text instead." })
  })

  it('Vercel 504 HTML -> our timeout copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => html(504, 'An error occurred with your deployment FUNCTION_INVOCATION_TIMEOUT')))
    const result = await parseResumeInput('x'.repeat(100), () => {})
    expect(result).toMatchObject({ ok: false, error: 'That took too long on our side. Please try again.' })
  })

  it('a 200 HTML page (e.g. an auth redirect landing) -> fallback copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })))
    const result = await parseResumeInput('x'.repeat(100), () => {})
    expect(result).toMatchObject({ ok: false, error: "We couldn't read that file, try again or paste your resume text." })
  })

  it('a stream that ends without "done" (function killed at maxDuration) -> fallback copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ndjson('{"type":"stage","stage":"extracting"}\n{"type":"stage","stage":"reading"}\n')))
    const result = await parseResumeInput('x'.repeat(100), () => {})
    expect(result).toMatchObject({ ok: false, error: "We couldn't read that file, try again or paste your resume text." })
  })

  it('a stream cut mid-line -> the feature\'s own fallback, not "can\'t reach us"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ndjson('{"type":"stage","stage":"extracting"}\n{"type":"sta')))
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await parseResumeInput('x'.repeat(100), () => {})
    spy.mockRestore()
    expect(result).toMatchObject({ ok: false, status: 500, error: "We couldn't read that file, try again or paste your resume text." })
  })

  it('a server error event is shown as sent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ndjson('{"type":"error","status":422,"error":"We couldn\'t find any text in that file."}\n')))
    const result = await parseResumeInput('x'.repeat(100), () => {})
    expect(result).toMatchObject({ ok: false, status: 422, error: "We couldn't find any text in that file." })
  })

  // Correct behavior: an expired session reads as a human message ("Your session expired.
  // Sign in again."), not the bare route string "Unauthorized".
  it('401 from an expired session shows a human message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Unauthorized' }, { status: 401 })))
    const result = await parseResumeInput('x'.repeat(100), () => {})
    expect((result as { error: string }).error).not.toBe('Unauthorized')
  })
})

describe('fetchJobFromUrl', () => {
  it('platform HTML error -> "Couldn\'t read that link."', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => html(504)))
    expect(await fetchJobFromUrl('https://x.io/j/1')).toMatchObject({ ok: false, error: "Couldn't read that link." })
  })

  it('needsPaste passes the server message through', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false, needsPaste: true, message: 'Paste it.' })))
    expect(await fetchJobFromUrl('https://x.io/j/1')).toEqual({ ok: false, needsPaste: true, message: 'Paste it.' })
  })

  it('network failure -> NETWORK copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await fetchJobFromUrl('https://x.io/j/1')).toMatchObject({ ok: false, status: 0 })
  })
})
