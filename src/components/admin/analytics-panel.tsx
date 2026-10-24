"use client"

// Funnel, errors, AI spend (by day and by model) and Pro counts for the admin page. Plain tables.
import { useEffect, useState } from "react"
import type { AnalyticsReport, WindowDays } from "@/lib/admin-analytics"
import { Button } from "@/components/ui/button"

const EVENT_ORDER = [
  "signed_up",
  "resume_parsed",
  "job_fetched",
  "tailored",
  "cover_letter_generated",
  "evidence_completed",
  "download",
  "limit_hit",
  "checkout_started",
  "checkout_completed",
  "ai_error",
  "ai_usage",
  "account_deleted",
]

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-text-muted"
const td = "px-3 py-2 text-sm text-text whitespace-nowrap"
const box = "bg-surface rounded-card p-4"
const fmtPct = (v: number | null) => (v === null ? "–" : `${v}%`)
const usd = (v: number) => `$${v.toFixed(2)}`

export function AnalyticsPanel() {
  const [days, setDays] = useState<WindowDays>(7)
  const [report, setReport] = useState<AnalyticsReport | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setError("")
    fetch(`/api/admin/analytics?days=${days}`)
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) setError(data.error || "Could not load analytics.")
        else setReport(data)
      })
      .catch(() => !cancelled && setError("Could not load analytics."))
    return () => {
      cancelled = true
    }
  }, [days])

  const names = report ? [...EVENT_ORDER, ...Object.keys(report.counts).filter((n) => !EVENT_ORDER.includes(n))] : []

  return (
    <section className="mb-10 space-y-6 text-text">
      <div className="flex items-center gap-3">
        <h2 className="font-serif text-2xl font-semibold text-text">Analytics</h2>
        {([7, 30] as const).map((d) => (
          <Button key={d} size="sm" variant={days === d ? "inverse" : "secondary"} aria-pressed={days === d} onClick={() => setDays(d)}>
            Last {d} days
          </Button>
        ))}
      </div>

      {error && <p className="rounded-input bg-removed p-3 text-sm text-text">{error}</p>}
      {!report && !error && <p className="text-sm text-text-muted">Loading analytics…</p>}

      {report && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div className={box}>
              <div className="text-2xl font-bold">{report.pro.activeUsers}</div>
              <div className="text-sm text-text-muted">Active Pro users</div>
            </div>
            <div className={box}>
              <div className="text-2xl font-bold">{usd(report.pro.mrrUsd)}</div>
              <div className="text-sm text-text-muted">MRR estimate ({report.pro.subscriptions} subs)</div>
            </div>
            <div className={box}>
              <div className="text-2xl font-bold">{usd(report.pro.passRevenue30dUsd)}</div>
              <div className="text-sm text-text-muted">Pass revenue, 30 days ({report.pro.passes} active)</div>
            </div>
            <div className={box}>
              <div className="text-2xl font-bold">{report.pro.comps}</div>
              <div className="text-sm text-text-muted">Comped Pro</div>
            </div>
            <div className={box}>
              <div className="text-2xl font-bold">{usd(report.spendTotalUsd)}</div>
              <div className="text-sm text-text-muted">AI spend estimate, {report.days} days</div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-card bg-surface">
              <table className="w-full">
                <caption className="px-3 pt-3 text-left text-sm font-semibold">
                  Funnel: users who signed up in the last {report.days} days
                </caption>
                <thead className="bg-surface-raised">
                  <tr>
                    <th className={th}>Step</th>
                    <th className={th}>Users</th>
                    <th className={th}>Of signups</th>
                    <th className={th}>Of previous</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.funnel.map((step) => (
                    <tr key={step.label}>
                      <td className={td}>{step.label}</td>
                      <td className={td}>{step.users}</td>
                      <td className={td}>{fmtPct(step.pctOfStart)}</td>
                      <td className={td}>{fmtPct(step.pctOfPrevious)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-card bg-surface">
              <table className="w-full">
                <caption className="px-3 pt-3 text-left text-sm font-semibold">Event counts</caption>
                <thead className="bg-surface-raised">
                  <tr>
                    <th className={th}>Event</th>
                    <th className={th}>Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {names.map((name) => (
                    <tr key={name}>
                      <td className={`${td} font-mono`}>{name}</td>
                      <td className={td}>{report.counts[name] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-card bg-surface">
              <table className="w-full">
                <caption className="px-3 pt-3 text-left text-sm font-semibold">AI spend by day (estimate from token counts)</caption>
                <thead className="bg-surface-raised">
                  <tr>
                    <th className={th}>Day (UTC)</th>
                    <th className={th}>Calls</th>
                    <th className={th}>Tokens in</th>
                    <th className={th}>Tokens out</th>
                    <th className={th}>Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.spendByDay.length === 0 && (
                    <tr>
                      <td className={td} colSpan={5}>No model calls yet.</td>
                    </tr>
                  )}
                  {report.spendByDay.map((row) => (
                    <tr key={row.day}>
                      <td className={td}>{row.day}</td>
                      <td className={td}>{row.calls}</td>
                      <td className={td}>{row.tokensIn.toLocaleString()}</td>
                      <td className={td}>{row.tokensOut.toLocaleString()}</td>
                      <td className={td}>{usd(row.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-card bg-surface">
              <table className="w-full">
                <caption className="px-3 pt-3 text-left text-sm font-semibold">AI spend by model (ai_call events, prices in models.ts)</caption>
                <thead className="bg-surface-raised">
                  <tr>
                    <th className={th}>Model</th>
                    <th className={th}>Calls</th>
                    <th className={th}>Tokens in / cached / out</th>
                    <th className={th}>Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.spendByModel.length === 0 && (
                    <tr>
                      <td className={td} colSpan={4}>No model calls logged yet.</td>
                    </tr>
                  )}
                  {report.spendByModel.map((row) => (
                    <tr key={`${row.provider}:${row.model}`}>
                      <td className={td}>
                        {row.model} <span className="text-text-muted">({row.provider})</span>
                      </td>
                      <td className={td}>{row.calls}</td>
                      <td className={td}>
                        {row.tokensIn.toLocaleString()} / {row.cachedIn.toLocaleString()} / {row.tokensOut.toLocaleString()}
                      </td>
                      <td className={td}>{usd(row.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-card bg-surface">
              <table className="w-full">
                <caption className="px-3 pt-3 text-left text-sm font-semibold">Errors by kind</caption>
                <thead className="bg-surface-raised">
                  <tr>
                    <th className={th}>Feature</th>
                    <th className={th}>Kind</th>
                    <th className={th}>Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.errorsByKind.length === 0 && (
                    <tr>
                      <td className={td} colSpan={3}>No errors.</td>
                    </tr>
                  )}
                  {report.errorsByKind.map((row) => (
                    <tr key={`${row.feature}:${row.kind}`}>
                      <td className={td}>{row.feature}</td>
                      <td className={`${td} font-mono`}>{row.kind}</td>
                      <td className={td}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-x-auto rounded-card bg-surface">
            <table className="w-full">
              <caption className="px-3 pt-3 text-left text-sm font-semibold">Recent errors</caption>
              <thead className="bg-surface-raised">
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>Feature</th>
                  <th className={th}>Kind</th>
                  <th className={th}>Took</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.recentErrors.length === 0 && (
                  <tr>
                    <td className={td} colSpan={4}>No errors.</td>
                  </tr>
                )}
                {report.recentErrors.map((e, i) => (
                  <tr key={`${e.at}-${i}`}>
                    <td className={td}>{new Date(e.at).toLocaleString()}</td>
                    <td className={td}>{e.feature}</td>
                    <td className={`${td} font-mono`}>{e.kind}</td>
                    <td className={td}>{e.ms === null ? "–" : `${(e.ms / 1000).toFixed(1)}s`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
