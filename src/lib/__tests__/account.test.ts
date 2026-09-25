// Account deletion: Stripe first, then files, then the user row. Nothing is deleted if
/* eslint-disable @typescript-eslint/no-unused-vars -- mock signatures keep their params for typed mock.calls */
// billing can't be stopped.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => {
  const order: string[] = []
  return {
    order,
    user: { id: 'user_1', stripeCustomerId: 'cus_1', resumes: [{ s3Key: 'users/user_1/resumes/a.pdf' }, { s3Key: null }] } as Record<string, unknown> | null,
    subRows: [] as { externalId: string }[],
    subs: [] as { id: string; status: string }[],
    stripeOn: true,
    cancelFails: false,
    userDelete: vi.fn(async (..._: unknown[]) => {
      order.push('user.delete')
      return {}
    }),
    cancel: vi.fn(async (id: string, ..._: unknown[]) => {
      order.push(`cancel:${id}`)
      if (m.cancelFails) throw new Error('stripe down')
      return { id, status: 'canceled' }
    }),
    retrieve: vi.fn(async (id: string) => ({ id, status: 'active' })),
    deleteFiles: vi.fn(async (_userId: string, keys: string[]) => {
      order.push('files')
      return { deleted: keys.length }
    }),
    track: vi.fn(async (..._: unknown[]) => {}),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => m.user), delete: m.userDelete },
    entitlement: { findMany: vi.fn(async () => m.subRows) },
  },
}))
vi.mock('@/lib/stripe', () => ({
  getStripe: () =>
    m.stripeOn
      ? { subscriptions: { list: vi.fn(async () => ({ data: m.subs })), retrieve: m.retrieve, cancel: m.cancel } }
      : null,
}))
vi.mock('@/lib/storage', () => ({ deleteUserFiles: m.deleteFiles }))
vi.mock('@/lib/track', () => ({ track: m.track }))

import { AccountDeletionError, deleteAccount } from '@/lib/account'

beforeEach(() => {
  m.order.length = 0
  m.user = { id: 'user_1', stripeCustomerId: 'cus_1', resumes: [{ s3Key: 'users/user_1/resumes/a.pdf' }, { s3Key: null }] }
  m.subRows = []
  m.subs = []
  m.stripeOn = true
  m.cancelFails = false
  vi.clearAllMocks()
})

describe('deleteAccount', () => {
  it('cancels live subscriptions before deleting files and the user', async () => {
    m.subs = [
      { id: 'sub_live', status: 'active' },
      { id: 'sub_old', status: 'canceled' },
      { id: 'sub_trial', status: 'trialing' },
    ]
    const result = await deleteAccount('user_1')
    expect(m.order).toEqual(['cancel:sub_live', 'cancel:sub_trial', 'files', 'user.delete'])
    expect(m.cancel).toHaveBeenCalledWith('sub_live', { invoice_now: false, prorate: false })
    expect(m.userDelete).toHaveBeenCalledWith({ where: { id: 'user_1' } })
    expect(m.deleteFiles).toHaveBeenCalledWith('user_1', ['users/user_1/resumes/a.pdf'])
    expect(result.canceledSubscriptions).toEqual(['sub_live', 'sub_trial'])
    // Anonymous event: no userId argument.
    expect(m.track).toHaveBeenCalledWith('account_deleted', expect.objectContaining({ canceledSubscriptions: 2 }))
    expect(m.track.mock.calls[0]).toHaveLength(2)
  })

  it('also cancels a subscription we only know from an entitlement row', async () => {
    m.user = { ...m.user!, stripeCustomerId: null }
    m.subRows = [{ externalId: 'sub_row' }]
    await deleteAccount('user_1')
    expect(m.retrieve).toHaveBeenCalledWith('sub_row')
    expect(m.order).toEqual(['cancel:sub_row', 'files', 'user.delete'])
  })

  it('deletes nothing when Stripe cancel fails', async () => {
    m.subs = [{ id: 'sub_live', status: 'active' }]
    m.cancelFails = true
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(deleteAccount('user_1')).rejects.toBeInstanceOf(AccountDeletionError)
    expect(m.userDelete).not.toHaveBeenCalled()
    expect(m.deleteFiles).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('deletes nothing when the user has billing history but Stripe is not configured', async () => {
    m.stripeOn = false
    await expect(deleteAccount('user_1')).rejects.toMatchObject({ status: 503 })
    expect(m.userDelete).not.toHaveBeenCalled()
  })

  it('skips Stripe entirely for a user who never paid', async () => {
    m.user = { ...m.user!, stripeCustomerId: null }
    m.stripeOn = false
    await deleteAccount('user_1')
    expect(m.order).toEqual(['files', 'user.delete'])
  })

  it('still deletes the user when file removal fails, and logs it', async () => {
    m.user = { ...m.user!, stripeCustomerId: null }
    m.deleteFiles.mockResolvedValueOnce({ deleted: 0, error: 'bucket missing' } as never)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await deleteAccount('user_1')
    expect(m.userDelete).toHaveBeenCalled()
    expect(result.fileError).toBe('bucket missing')
    expect(spy.mock.calls[0][0]).toMatch(/ACCOUNT_DELETE_FILES_FAILED/)
    spy.mockRestore()
  })

  it('404s for a missing user', async () => {
    m.user = null
    await expect(deleteAccount('nope')).rejects.toMatchObject({ status: 404 })
  })
})
