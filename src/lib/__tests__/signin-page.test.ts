// The sign-in page sends someone who is already signed in where they were headed, so a
// replayed Google callback (Back button) doesn't strand them on a "didn't finish" error.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.value) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { to })
  }),
}))

import SignInPage from '@/app/(app)/auth/signin/page'

async function landing(params: Record<string, string>) {
  try {
    await SignInPage({ searchParams: Promise.resolve(params) })
    return 'rendered'
  } catch (error) {
    // JSX isn't set up for page components here; anything but a redirect means it rendered.
    return (error as { to?: string }).to ?? 'rendered'
  }
}

beforeEach(() => {
  session.value = null
})

describe('sign-in page', () => {
  it('renders for a signed-out visitor, error or not', async () => {
    expect(await landing({ error: 'Callback' })).toBe('rendered')
  })

  it('sends a signed-in user to their deep link or the dashboard', async () => {
    session.value = { user: { id: 'u1' } }
    expect(await landing({ error: 'Callback' })).toBe('/dashboard')
    expect(await landing({ callbackUrl: '/dashboard/tracker?x=1' })).toBe('/dashboard/tracker?x=1')
    expect(await landing({ callbackUrl: 'https://evil.example/steal' })).toBe('/dashboard')
    expect(await landing({ callbackUrl: '/auth/signin' })).toBe('/dashboard')
  })
})
