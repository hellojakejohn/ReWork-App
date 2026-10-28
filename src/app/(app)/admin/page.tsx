'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AnalyticsPanel } from '@/components/admin/analytics-panel'
import { Button } from '@/components/ui/button'

interface User {
  id: string
  name: string | null
  email: string
  plan: 'FREE' | 'PREMIUM'
  resumesCreated: number
  createdAt: string
  lastActiveAt: string
  ai: {
    mtdSpendUsd: number
    periodSpendUsd: number
    capUsd: number
    percent: number
    band: 'normal' | 'downgrade' | 'paused'
    period: 'monthly' | 'pass' | 'comp' | 'free'
    resetAt: string
    overrideUsd: number | null
  } | null
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    free: 0,
    premium: 0,
    totalResumes: 0
  })

  useEffect(() => {
    document.title = "Admin · rework"
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Allowlist lives in ADMIN_EMAILS on the server; the session carries the result.
    if (!session.user?.isAdmin) {
      router.push('/')
      return
    }

    fetchUsers()
  }, [session, status, router])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      setUsers(data.users)
      setStats(data.stats)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const compPro = async (user: User) => {
    const input = window.prompt(`Comp Pro for ${user.email}. How many days?`, '30')
    if (input === null) return
    const days = Number(input)
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      window.alert('Enter a whole number of days between 1 and 3650.')
      return
    }
    const response = await fetch(`/api/admin/users/${user.id}/comp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days })
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      window.alert(data.error || 'Comp failed')
      return
    }
    await fetchUsers()
  }

  const setCap = async (user: User) => {
    const current = user.ai?.overrideUsd
    const input = window.prompt(
      `AI cap override for ${user.email}, in USD per cap period (${user.ai?.period ?? 'period'}). Blank = back to the default (${user.ai ? usd(user.ai.capUsd) : 'ratio x net'}).`,
      current === null || current === undefined ? '' : String(current)
    )
    if (input === null) return
    const capUsd = input.trim() === '' ? null : Number(input)
    if (capUsd !== null && (!Number.isFinite(capUsd) || capUsd < 0 || capUsd > 1000)) {
      window.alert('Enter a dollar amount from 0 to 1000, or leave it blank.')
      return
    }
    const response = await fetch(`/api/admin/users/${user.id}/ai-cap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capUsd })
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      window.alert(data.error || 'Saving the cap failed')
      return
    }
    await fetchUsers()
  }

  const exportUsers = async () => {
    try {
      const response = await fetch('/api/admin/users/export')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting users:', error)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-bg p-8 text-text-muted">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-bg text-text">
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <h1 className="font-serif text-3xl font-semibold mb-6 text-text">Admin Dashboard</h1>
      <AnalyticsPanel />
      <div className="mb-8">
        <h2 className="font-serif text-2xl font-semibold mb-4 text-text">Users</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface p-4 rounded-card">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-text-muted">Total Users</div>
          </div>
          <div className="bg-surface p-4 rounded-card">
            <div className="text-2xl font-bold">{stats.free}</div>
            <div className="text-sm text-text-muted">Free Users</div>
          </div>
          <div className="bg-surface p-4 rounded-card">
            <div className="text-2xl font-bold">{stats.premium}</div>
            <div className="text-sm text-text-muted">Pro Users</div>
          </div>
          <div className="bg-surface p-4 rounded-card">
            <div className="text-2xl font-bold">{stats.totalResumes}</div>
            <div className="text-sm text-text-muted">Total Resumes</div>
          </div>
        </div>

        <Button variant="secondary" onClick={exportUsers}>
          Export Users CSV
        </Button>
      </div>

      <div className="bg-surface rounded-card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-raised">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Resumes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Last Active
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                AI spend (MTD)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                AI cap
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-surface-raised">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-text">
                    {user.name || 'No name'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-text">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.plan === 'PREMIUM' 
                      ? 'bg-success-tint text-success' 
                      : 'bg-surface-raised text-text-secondary'
                  }`}>
                    {user.plan}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                  {user.resumesCreated}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                  {new Date(user.lastActiveAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                  {user.ai ? usd(user.ai.mtdSpendUsd) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                  {user.ai ? (
                    <span title={`${user.ai.period} period, resets ${new Date(user.ai.resetAt).toLocaleDateString()}`}>
                      {usd(user.ai.periodSpendUsd)} / {usd(user.ai.capUsd)} ({user.ai.percent}%)
                      {user.ai.band !== 'normal' && <span className="ml-1 text-warn">{user.ai.band}</span>}
                      {user.ai.overrideUsd !== null && <span className="ml-1 text-accent-strong">override</span>}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Button variant="text" size="sm" onClick={() => compPro(user)}>
                    Comp Pro for N days
                  </Button>
                  <Button variant="text" size="sm" className="ml-1" onClick={() => setCap(user)}>
                    Set AI cap
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  )
}
