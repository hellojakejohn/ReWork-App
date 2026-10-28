import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Browsers POST Content-Security-Policy-Report-Only violations here (next.config.ts), so
// "watch, then enforce" has something to watch: search the runtime logs for [csp].
export async function POST(request: NextRequest) {
  const body = (await request.text().catch(() => '')).slice(0, 2000)
  try {
    const report = JSON.parse(body)
    const r = report['csp-report'] ?? report[0]?.body ?? report
    console.warn('[csp]', JSON.stringify({ directive: r['violated-directive'] ?? r.effectiveDirective, blocked: r['blocked-uri'] ?? r.blockedURL, page: r['document-uri'] ?? r.documentURL }))
  } catch {
    console.warn('[csp] unparseable report')
  }
  return new NextResponse(null, { status: 204 })
}
