import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: vi.fn(async () => [{ '?column?': 1 }]) } }))
vi.mock('@/lib/entitlements', () => ({ expireEntitlements: vi.fn(async () => ({ expired: 0, users: 0 })) }))

import { GET as keepalive } from '@/app/api/keepalive/route'
import { GET as expire } from '@/app/api/cron/expire-entitlements/route'

const saved = process.env.CRON_SECRET
afterEach(() => {
  if (saved === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = saved
})

const call = (handler: (req: Request) => Promise<Response>, auth?: string) =>
  handler(new Request('https://rework.test/api/cron', { headers: auth ? { authorization: auth } : {} }))

describe.each([
  ['keepalive', keepalive],
  ['expire-entitlements', expire],
])('%s cron auth', (_name, handler) => {
  it('refuses everyone when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    expect((await call(handler)).status).toBe(401)
    expect((await call(handler, 'Bearer undefined')).status).toBe(401)
  })

  it('needs the exact bearer token when it is set', async () => {
    process.env.CRON_SECRET = 's3cret'
    expect((await call(handler, 'Bearer nope')).status).toBe(401)
    expect((await call(handler, 'Bearer s3cret')).status).toBe(200)
  })
})
