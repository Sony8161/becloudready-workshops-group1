import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Spinner from '../../components/Spinner'
import { useToast } from '../../components/Toast'
import { Avatar, Badge, EmptyState, ErrorBox, PageHead, Progress, Stat } from '../../components/ui'
import { api } from '../../lib/api'
import { dueLabel, fmtDate, timeAgo } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { CopyPlanModal, PlanModal } from './PlanModals'

export default function PlanDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const isManager = user.role === 'MANAGER'
  const toast = useToast()
  const navigate = useNavigate()
  const { data: p, error, loading, reload } = useApi(`/api/plans/${id}`)
  const [modal, setModal] = useState(null)

  if (loading && !p) return <Spinner />
  if (error && !p) return <ErrorBox error={error} onRetry={reload} />

  const setStatus = async (action) => {
    try { await api.post(`/api/plans/${p.id}/${action}`); toast(action === 'archive' ? 'Plan archived' : 'Plan restored'); reload() } catch (err) { toast(err.message, 'bad') }
  }
  const stuck = p.trainees.filter((t) => t.state === 'BLOCKED').length
  const behind = p.trainees.filter((t) => t.state === 'BEHIND').length

  return (
    <>
      <div className="crumbs"><Link to="/plans">Training plans</Link> / {p.title}</div>
      <PageHead title={p.title}
        subtitle={<>Assigned to {p.assignee_type === 'COHORT' ? <Link to={`/cohorts/${p.assignee_id}`}>{p.assignee_name}</Link> : <Link to={`/trainees/${p.assignee_id}`}>{p.assignee_name} (solo)</Link>} · created {fmtDate(p.created_at)}</>}
        actions={isManager && (
          <>
            {p.status === 'ACTIVE'
              ? <button className="btn btn-danger-ghost" onClick={() => setStatus('archive')}>Archive</button>
              : <button className="btn" onClick={() => setStatus('restore')}>Restore</button>}
            <button className="btn" onClick={() => setModal('copy')}>Reuse for…</button>
            <button className="btn btn-primary" onClick={() => setModal('edit')}>Edit</button>
          </>
        )} />
      {p.status === 'ARCHIVED' && <div className="alert alert-warn">This plan is archived. Trainees no longer see it.</div>}
      {p.description && <p className="lead">{p.description}</p>}

      <div className="stats">
        <Stat label="Trainees" value={p.trainee_count} />
        <Stat label="Average progress" value={`${p.avg_progress}%`} />
        <Stat label="Blocked" value={stuck} tone={stuck ? 'bad' : undefined} />
        <Stat label="Behind" value={behind} tone={behind ? 'warn' : undefined} />
      </div>

      <div className="grid-2 grid-2-flip">
        <section className="card">
          <div className="card-head"><h2>Tasks</h2></div>
          <ol className="tasks numbered">
            {p.tasks.map((t) => (
              <li key={t.id} className="task">
                <span className="task-title">{t.title}</span>
                <span className="task-due small">{t.due_date ? `${fmtDate(t.due_date)} · ${dueLabel(t.due_date)}` : 'No due date'}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="card">
          <div className="card-head"><h2>Progress by trainee</h2><Link className="small" to={`/reports?plan_id=${p.id}`}>Reports for this plan</Link></div>
          {p.trainees.length === 0 ? <EmptyState title="No trainees yet">Add trainees to the cohort and they get this plan.</EmptyState> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Trainee</th><th>State</th><th className="w-progress">Progress</th><th className="num">Overdue</th><th>Last report</th></tr></thead>
                <tbody>
                  {p.trainees.map((t) => (
                    <tr key={t.trainee_id}>
                      <td><div className="person"><Avatar name={t.name} /><Link to={`/trainees/${t.trainee_id}`}>{t.name}</Link></div></td>
                      <td><Badge value={t.state} /></td>
                      <td><div className="progress-cell"><Progress value={t.progress} size="sm" tone={t.state === 'BLOCKED' ? 'bad' : undefined} /><span>{t.done_count}/{t.task_count}</span></div></td>
                      <td className={`num ${t.overdue_count ? 'text-bad' : ''}`}>{t.overdue_count || '—'}</td>
                      <td className="small">{timeAgo(t.last_report_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {modal === 'edit' && <PlanModal plan={p} onClose={() => setModal(null)} onDone={() => { setModal(null); toast('Plan saved. Trainees were notified.'); reload() }} />}
      {modal === 'copy' && <CopyPlanModal plan={p} onClose={() => setModal(null)} onDone={(n) => { setModal(null); toast('Copy created'); navigate(`/plans/${n.id}`) }} />}
    </>
  )
}