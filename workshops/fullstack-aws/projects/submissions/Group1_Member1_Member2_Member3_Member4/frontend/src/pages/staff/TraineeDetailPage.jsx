import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import PlanProgress from '../../components/PlanProgress'
import ReportCard from '../../components/ReportCard'
import Spinner from '../../components/Spinner'
import { Avatar, Badge, EmptyState, ErrorBox, PageHead } from '../../components/ui'
import { fmtDate, timeAgo } from '../../lib/format'
import { useApi } from '../../lib/useApi'

export default function TraineeDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, error, loading, reload } = useApi(`/api/dashboard/trainees/${id}`)

  if (loading && !data) return <Spinner />
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />
  const t = data.trainee

  return (
    <>
      <div className="crumbs"><Link to="/dashboard">Dashboard</Link> / <Link to="/trainees">People</Link> / {t.name}</div>
      <PageHead
        title={<span className="person-title"><Avatar name={t.name} size={44} /> {t.name}</span>}
        subtitle={`${t.email}${t.track ? ` · ${t.track}` : ''} · started ${fmtDate(t.start_date)}`}
        actions={
          <>
            <Badge value={data.status} />
            {user.role === 'MANAGER' && t.status === 'ACTIVE' && (
              <Link className="btn btn-primary" to={`/plans?new=1&type=TRAINEE&id=${t.id}`}>Assign solo plan</Link>
            )}
          </>
        }
      />
      <div className="info-row">
        <div><span className="muted small">Cohorts</span><div>{t.cohorts.length ? t.cohorts.map((c) => <Link key={c.id} className="tag" to={`/cohorts/${c.id}`}>{c.name}</Link>) : <span className="text-warn">None</span>}</div></div>
        <div><span className="muted small">Reports sent</span><div>{data.report_count}</div></div>
        <div><span className="muted small">Last sign-in</span><div>{t.last_login_at ? timeAgo(t.last_login_at) : 'Never'}</div></div>
        <div><span className="muted small">Unread notices</span><div>{data.unread_notices}</div></div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Training plans</h2></div>
          {data.plans.length === 0 ? (
            <EmptyState title="No plans yet">Add them to a cohort with plans, or assign a solo plan.</EmptyState>
          ) : (
            <div className="stack">
              {data.plans.map((p) => <PlanProgress key={p.plan_id} plan={p} link={`/plans/${p.plan_id}`} />)}
            </div>
          )}
        </section>
        <section className="card">
          <div className="card-head"><h2>Recent reports</h2><Link className="small" to={`/reports?trainee_id=${t.id}`}>All reports</Link></div>
          {data.recent_reports.length === 0 ? <EmptyState title="No reports yet" /> : (
            <div className="stack">
              {data.recent_reports.map((r) => <ReportCard key={r.id} report={r} staff showTrainee={false} onChange={reload} />)}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
