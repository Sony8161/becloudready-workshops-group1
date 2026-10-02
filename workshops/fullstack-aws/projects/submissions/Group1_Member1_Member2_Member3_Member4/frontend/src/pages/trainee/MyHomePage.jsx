import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import PlanProgress from '../../components/PlanProgress'
import ReportCard from '../../components/ReportCard'
import Spinner from '../../components/Spinner'
import SubmitReportModal from '../../components/SubmitReportModal'
import { useToast } from '../../components/Toast'
import { Badge, EmptyState, ErrorBox, PageHead, Stat } from '../../components/ui'
import { timeAgo } from '../../lib/format'
import { useApi } from '../../lib/useApi'

export default function MyHomePage() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, error, loading, reload } = useApi('/api/me/overview')
  const [reporting, setReporting] = useState(null)

  if (loading && !data) return <Spinner />
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />

  const overall = data.plans.length ? Math.round(data.plans.reduce((s, p) => s + p.progress, 0) / data.plans.length) : 0
  const unread = data.notices.filter((n) => !n.read)
  const withFeedback = data.recent_reports.filter((r) => r.feedback).slice(0, 2)

  return (
    <>
      <PageHead title={`Hi, ${user.name.split(' ')[0]}`}
        subtitle={data.trainee.cohorts.length ? `You're in ${data.trainee.cohorts.map((c) => c.name).join(', ')}` : 'You are not in a cohort yet.'}
        actions={data.plans.length > 0 && <button className="btn btn-primary" onClick={() => setReporting({})}>Submit progress report</button>} />

      <div className="stats">
        <Stat label="My status" value={<Badge value={data.status} />} />
        <Stat label="Overall progress" value={`${overall}%`} hint={`${data.plans.length} plan${data.plans.length === 1 ? '' : 's'}`} />
        <Stat label="Unread notices" value={data.unread_notices} tone={data.unread_notices ? 'info' : undefined} />
        <Stat label="Reports sent" value={data.report_count} hint={data.recent_reports[0] ? `last ${timeAgo(data.recent_reports[0].created_at)}` : 'none yet'} />
      </div>

      {unread.length > 0 && (
        <section className="card card-accent">
          <div className="card-head"><h2>New notices</h2><Link to="/me/notices" className="small">All notices</Link></div>
          <ul className="mini-list">
            {unread.slice(0, 3).map((n) => (
              <li key={n.id}>
                <Link to={`/me/notices/${n.id}`}>
                  <span><strong>{n.title}</strong><span className="small muted"> · {n.author}</span></span>
                  <span className="mini-meta">{n.priority !== 'NORMAL' && <Badge value={n.priority} />}<span className="small muted">{timeAgo(n.created_at)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>My training plans</h2></div>
          {data.plans.length === 0 ? (
            <EmptyState title="No plans yet">Your Training Manager will assign one soon. You'll get a notification.</EmptyState>
          ) : (
            <div className="stack">
              {data.plans.map((p) => (
                <PlanProgress key={p.plan_id} plan={p} compact link={`/me/plans/${p.plan_id}`}
                  action={p.state !== 'COMPLETE' && (
                    <div className="row-gap">
                      <Link className="btn btn-sm" to={`/me/plans/${p.plan_id}`}>Open</Link>
                      <button className="btn btn-sm btn-ghost" onClick={() => setReporting({ planId: p.plan_id })}>Report on this</button>
                    </div>
                  )} />
              ))}
            </div>
          )}
        </section>
        <section className="card">
          <div className="card-head"><h2>Latest feedback</h2><Link to="/me/reports" className="small">My reports</Link></div>
          {withFeedback.length === 0 ? <EmptyState title="No feedback yet">Replies from your manager show up here.</EmptyState> : (
            <div className="stack">{withFeedback.map((r) => <ReportCard key={r.id} report={r} showTrainee={false} />)}</div>
          )}
        </section>
      </div>

      {reporting && (
        <SubmitReportModal plans={data.plans} planId={reporting.planId} onClose={() => setReporting(null)}
          onDone={() => { setReporting(null); toast('Report sent. Your manager was notified.'); reload() }} />
      )}
    </>
  )
}
