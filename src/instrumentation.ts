// Server errors Next catches (a route or page that throws) are written to `events` as
// server_error, so /admin's error list shows them next to AI errors. No third-party
// service: for alerts, add Sentry (docs/launch-audit.md).
import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { track } = await import('@/lib/track')
    const e = error as { name?: string; message?: string; digest?: string }
    await track('server_error', {
      feature: context.routePath || request.path.split('?')[0],
      kind: e.name || 'Error',
      method: request.method,
      message: String(e.message ?? '').slice(0, 200),
      digest: e.digest ?? null,
    })
  } catch {
    // Never let error reporting throw.
  }
}
