'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// Preview the weekly and welcome emails (built from your own account) and send yourself a test.
export function EmailPanel() {
  const [sending, setSending] = useState<string | null>(null)
  const test = async (kind: 'weekly' | 'welcome') => {
    setSending(kind)
    try {
      const res = await fetch('/api/admin/email-preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind }) })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.ok) toast.success('Sent. Check your inbox.')
      else toast.error(body.error || 'Not sent.')
    } finally {
      setSending(null)
    }
  }
  return (
    <section className="mb-8 rounded-card border border-border bg-surface p-4">
      <h2 className="font-serif text-2xl font-semibold text-text">Emails</h2>
      <p className="mt-1 text-sm text-text-muted">
        Weekly sends follow <code>EMAIL_WEEKLY</code> (off, dry, admins, live); welcome follows <code>EMAIL_WELCOME</code>. Both need{' '}
        <code>RESEND_API_KEY</code> and <code>EMAIL_MAILING_ADDRESS</code>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" asChild>
          <a href="/api/admin/email-preview?kind=weekly" target="_blank" rel="noreferrer">Preview weekly</a>
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <a href="/api/admin/email-preview?kind=welcome" target="_blank" rel="noreferrer">Preview welcome</a>
        </Button>
        <Button variant="text" size="sm" disabled={!!sending} onClick={() => void test('weekly')}>
          {sending === 'weekly' ? 'Sending...' : 'Send me a test weekly'}
        </Button>
        <Button variant="text" size="sm" disabled={!!sending} onClick={() => void test('welcome')}>
          {sending === 'welcome' ? 'Sending...' : 'Send me a test welcome'}
        </Button>
      </div>
    </section>
  )
}
