import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Spinner from '../../components/Spinner'
import { useToast } from '../../components/Toast'
import { Badge, EmptyState, ErrorBox, PageHead, Progress } from '../../components/ui'
import { qs } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { PlanModal } from './PlanModals'

export default function PlansPage() {
  const { user } = useAuth()
  const isManager = user.role === 'MANAGER'
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('ACTIVE')
  const [kind, setKind] = useState('')
  const navigate = useNavigate()
  const toast = useToast()
  const { data, error, loading, reload } = useApi(`/api/plans${qs({ status, assignee_type: kind })}`)
  const creating = isManager && params.get('new') === '1'
  const preset = params.get('type') ? { type: params.get('type'), id: params.get('id') || '' } : null

  return (
    <>
      <PageHead title="Training plans" subtitle="Tasks with due dates, assigned to a cohort or to one trainee."
        actions={isManager && <button className="btn btn-primary" onClick={() => setParams({ new: '1' })}>New plan</button>} />
      <section className="card">
        <div className="toolbar">
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option><option value="ALL">All</option>
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Assigned to">
            <option value="">Cohort and solo</option><option value="COHORT">Cohort plans</option><option value="TRAINEE">Solo tracks</option>
          </select>
          {!isManager && <span className="small muted">Only Training Managers create plans.</span>}
        </div>
        <ErrorBox error={error} onRetry={reload} />
        {loading && !data ? <Spinner /> : data?.length === 0 ? (
          <EmptyState title="No plans here" action={isManager && <button className="btn btn-primary" onClick={() => setParams({ new: '1' })}>Create a plan</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table table-click">
              <thead><tr><th>Plan</th><th>Assigned to</th><th className="num">Tasks</th><th className="num">Trainees</th><th className="w-progress">Avg progress</th><th>Created</th></tr></thead>
              <tbody>
                {data?.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/plans/${p.id}`)}>
                    <td><Link to={`/plans/${p.id}`} onClick={(e) => e.stopPropagation()}>{p.title}</Link>{p.status === 'ARCHIVED' && <> <Badge value="ARCHIVED" /></>}</td>
                    <td>{p.assignee_name} <span className="small muted">{p.assignee_type === 'TRAINEE' ? '(solo)' : ''}</span></td>
                    <td className="num">{p.task_count}</td>
                    <td className="num">{p.trainee_count}</td>
                    <td><div className="progress-cell"><Progress value={p.avg_progress} size="sm" /><span>{p.avg_progress}%</span></div></td>
                    <td className="small">{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {creating && (
        <PlanModal preset={preset} onClose={() => setParams({})}
          onDone={(p) => { toast(`Plan created. ${p.trainee_count} trainee${p.trainee_count === 1 ? '' : 's'} notified.`); navigate(`/plans/${p.id}`) }} />
      )}
    </>
  )
}
