'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AnalyticsPanel } from '@/components/admin/analytics-panel'

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
    document.title = "Admin Panel - ReWork"
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
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-white">Admin Dashboard</h1>
      <AnalyticsPanel />
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-white">Users</h2>
        
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold">{stats.free}</div>
            <div className="text-sm text-gray-600">Free Users</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold">{stats.premium}</div>
            <div className="text-sm text-gray-600">Pro Users</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold">{stats.totalResumes}</div>
            <div className="text-sm text-gray-600">Total Resumes</div>
          </div>
        </div>

        <button
          onClick={exportUsers}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Export Users CSV
        </button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resumes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Active
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                AI spend (MTD)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                AI cap
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {user.name || 'No name'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.plan === 'PREMIUM' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.plan}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.resumesCreated}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(user.lastActiveAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.ai ? usd(user.ai.mtdSpendUsd) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.ai ? (
                    <span title={`${user.ai.period} period, resets ${new Date(user.ai.resetAt).toLocaleDateString()}`}>
                      {usd(user.ai.periodSpendUsd)} / {usd(user.ai.capUsd)} ({user.ai.percent}%)
                      {user.ai.band !== 'normal' && <span className="ml-1 text-amber-700">{user.ai.band}</span>}
                      {user.ai.overrideUsd !== null && <span className="ml-1 text-blue-700">override</span>}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => compPro(user)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Comp Pro for N days
                  </button>
                  <button
                    onClick={() => setCap(user)}
                    className="ml-3 text-blue-600 hover:text-blue-800 underline"
                  >
                    Set AI cap
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}