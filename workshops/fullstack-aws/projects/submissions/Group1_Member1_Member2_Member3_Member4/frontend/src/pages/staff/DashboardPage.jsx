import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ActivityChart from '../../components/ActivityChart'
import Spinner from '../../components/Spinner'
import { Avatar, Badge, EmptyState, ErrorBox, PageHead, Progress, Stat } from '../../components/ui'
import { downloadCsv } from '../../lib/csv'
import { STATUS, fmtDate, timeAgo } from '../../lib/format'
import { qs } from '../../lib/api'
import { useApi } from '../../lib/useApi'

const FILTERS = ['ALL', 'AT_RISK', 'BLOCKED', 'NOT_REPORTING', 'BEHIND', 'UNASSIGNED', 'ON_TRACK', 'COMPLETE']
const AT_RISK = ['BLOCKED', 'NOT_REPORTING', 'BEHIND']

export default function DashboardPage() {
  const [cohortId, setCohortId] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { data, error, loading, reload } = useApi(`/api/dashboard${qs({ cohort_id: cohortId })}`)
  const cohorts = useApi('/api/cohorts')

  useEffect(() => {
    const id = setInterval(reload, 60000)
    return () => clearInterval(id)
  }, [reload])

  const rows = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.trainees.filter((t) => {
      if (filter === 'AT_RISK' && !AT_RISK.includes(t.status)) return false
      if (filter !== 'ALL' && filter !== 'AT_RISK' && t.status !== filter) return false
      return !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
    })
  }, [data, filter, search])

  if (loading && !data) return <Spinner label="Loading dashboard" />
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />
  const s = data.summary
  const count = (key) => key === 'ALL' ? data.trainees.length
    : key === 'AT_RISK' ? s.at_risk : (s.status_counts[key] || 0)

  const exportCsv = () => downloadCsv(`trainee-tracker-${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: 'Name', value: (r) => r.name },
    { label: 'Email', value: (r) => r.email },
    { label: 'Track', value: (r) => r.track },
    { label: 'Cohorts', value: (r) => r.cohorts.join('; ') },
    { label: 'Status', value: (r) => STATUS[r.status]?.label },
    { label: 'Plans', value: (r) => r.plan_count },
    { label: 'Progress %', value: (r) => r.progress },
    { label: 'Overdue tasks', value: (r) => r.overdue_count },
    { label: 'Last report', value: (r) => r.last_report_at ? fmtDate(r.last_report_at) : 'Never' },
  ], rows)

  return (
    <>
      <PageHead
        title="Dashboard"
        subtitle={`Live view of every trainee · updated ${timeAgo(data.generated_at)}`}
        actions={
          <>
            <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} aria-label="Cohort">
              <option value="">All cohorts</option>
              {(cohorts.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn" onClick={exportCsv}>Export CSV</button>
            <button className="btn" onClick={reload}>Refresh</button>
          </>
        }
      />

      <div className="stats">
        <Stat label="Active trainees" value={s.active_trainees} hint={`${s.cohorts} cohort${s.cohorts === 1 ? '' : 's'} · ${s.no_cohort} without one`} />
        <Stat label="Average progress" value={`${s.avg_progress}%`} hint={`${s.active_plans} active plans`} />
        <Stat label="At risk" value={s.at_risk} tone={s.at_risk ? 'bad' : undefined} hint="Blocked, quiet or behind"
          onClick={() => setFilter('AT_RISK')} />
        <Stat label="Unassigned" value={s.unassigned} tone={s.unassigned ? 'warn' : undefined} hint="No training plan yet"
          onClick={() => setFilter('UNASSIGNED')} />
        <Stat label="Reports (7 days)" value={s.reports_7d} />
        <Stat label="Awaiting review" value={s.awaiting_feedback} tone={s.awaiting_feedback ? 'info' : undefined}
          hint="Open the review queue" onClick={() => navigate('/reports')} />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Trainees</h2>
            <input className="search" type="search" placeholder="Search name or email" value={search}
              onChange={(e) => setSearch(e.target.value)} aria-label="Search trainees" />
          </div>
          <div className="chips" role="tablist" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={`chip ${filter === f ? 'chip-on' : ''}`}
                onClick={() => setFilter(f)}>
                {f === 'ALL' ? 'All' : f === 'AT_RISK' ? 'At risk' : STATUS[f].label}
                <span className="chip-count">{count(f)}</span>
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState title="Nobody here">No trainees match this filter.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table table-click">
                <thead>
                  <tr><th>Trainee</th><th>Status</th><th className="w-progress">Progress</th><th className="num">Overdue</th><th>Last report</th></tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} onClick={() => navigate(`/trainees/${t.id}`)}>
                      <td>
                        <div className="person">
                          <Avatar name={t.name} />
                          <div>
                            <Link to={`/trainees/${t.id}`} onClick={(e) => e.stopPropagation()}>{t.name}</Link>
                            <div className="small muted">{t.cohorts.length ? t.cohorts.join(', ') : 'No cohort'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge value={t.status} />
                        {t.blocked_plans.length > 0 && <div className="small muted">{t.blocked_plans.join(', ')}</div>}
                      </td>
                      <td>
                        {t.plan_count ? (
                          <div className="progress-cell"><Progress value={t.progress} size="sm" /><span>{t.progress}%</span></div>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td className={`num ${t.overdue_count ? 'text-bad' : ''}`}>{t.overdue_count || '—'}</td>
                      <td className={t.status === 'NOT_REPORTING' ? 'text-warn' : ''}>{timeAgo(t.last_report_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Cohorts</h2><Link to="/cohorts" className="small">Manage</Link></div>
            {data.cohorts.length === 0 && <EmptyState title="No cohorts yet" />}
            <ul className="cohort-list">
              {data.cohorts.map((c) => (
                <li key={c.id}>
                  <Link to={`/cohorts/${c.id}`} className="cohort-row">
                    <div className="cohort-top">
                      <strong>{c.name}</strong>
                      <span className="small muted">{c.manager || 'No lead'}</span>
                    </div>
                    <div className="progress-cell"><Progress value={c.avg_progress} size="sm" /><span>{c.avg_progress}%</span></div>
                    <div className="small muted">
                      {c.trainee_count} trainees · {c.plan_count} plans · {c.reports_7d} reports this week
                      {c.at_risk > 0 && <> · <span className="text-bad">{c.at_risk} at risk</span></>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="card-head"><h2>Reports per day</h2><span className="small muted">last 14 days</span></div>
            <ActivityChart data={data.activity} />
          </section>

          <section className="card">
            <div className="card-head"><h2>Waiting for review</h2><Link to="/reports" className="small">Open queue</Link></div>
            {data.awaiting_feedback.length === 0 ? <p className="muted">All caught up.</p> : (
              <ul className="mini-list">
                {data.awaiting_feedback.map((r) => (
                  <li key={r.id}>
                    <Link to={`/reports?focus=${r.id}`}>
                      <span><strong>{r.trainee_name}</strong> · {r.task_title || r.plan_title}</span>
                      <span className="mini-meta"><Badge value={r.status} /> {timeAgo(r.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Notice reach</h2><Link to="/notices" className="small">All notices</Link></div>
            {data.notices.length === 0 ? <p className="muted">No notices yet.</p> : (
              <ul className="mini-list">
                {data.notices.map((n) => (
                  <li key={n.id}>
                    <Link to={`/notices?focus=${n.id}`}>
                      <span>{n.title}<span className="small muted"> · {n.audience_name}</span></span>
                      <span className="mini-meta">
                        <span className="small">{n.read_count}/{n.audience_size} read</span>
                        <Progress value={n.audience_size ? (100 * n.read_count) / n.audience_size : 0} size="xs" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
