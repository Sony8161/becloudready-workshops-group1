import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Spinner from '../../components/Spinner'
import { useToast } from '../../components/Toast'
import { Avatar, Badge, EmptyState, ErrorBox, Modal, PageHead, Progress, Stat } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate, timeAgo } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { CohortModal } from './CohortsPage'

function AddMembersModal({ cohort, onClose, onDone }) {
  const trainees = useApi('/api/users?role=TRAINEE&status=ACTIVE')
  const [picked, setPicked] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const inCohort = new Set(cohort.members.map((m) => m.id))
  const options = (trainees.data || [])
    .filter((t) => !inCohort.has(t.id))
    .filter((t) => !q || `${t.name} ${t.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.cohorts.length - b.cohorts.length) || a.name.localeCompare(b.name))
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const save = async () => {
    setBusy(true); setError(null)
    try { onDone(await api.post(`/api/cohorts/${cohort.id}/members`, { trainee_ids: picked })) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return (
    <Modal title={`Add trainees to ${cohort.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !picked.length} onClick={save}>{busy ? <Spinner inline /> : `Add ${picked.length || ''}`}</button></>}>
      <ErrorBox error={error} />
      <input className="search full" type="search" placeholder="Search trainees" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search trainees" />
      {trainees.loading && !trainees.data ? <Spinner /> : options.length === 0 ? <p className="muted">Everyone is already in this cohort.</p> : (
        <ul className="pick-list">
          {options.map((t) => (
            <li key={t.id}>
              <label className="pick">
                <input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} />
                <Avatar name={t.name} size={28} />
                <span className="pick-text"><strong>{t.name}</strong><span className="small muted">{t.email}</span></span>
                {t.cohorts.length === 0 ? <span className="badge badge-warn">No cohort</span> : <span className="small muted">{t.cohorts.map((c) => c.name).join(', ')}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

export default function CohortDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const cohort = useApi(`/api/cohorts/${id}`)
  const dash = useApi(`/api/dashboard?cohort_id=${id}`)
  const plans = useApi(`/api/plans?assignee_type=COHORT&assignee_id=${id}`)
  const [modal, setModal] = useState(null)

  const statusById = useMemo(() => Object.fromEntries((dash.data?.trainees || []).map((t) => [t.id, t])), [dash.data])

  if (cohort.loading && !cohort.data) return <Spinner />
  if (cohort.error && !cohort.data) return <ErrorBox error={cohort.error} onRetry={cohort.reload} />
  const c = cohort.data
  const reloadAll = () => { cohort.reload(); dash.reload(); plans.reload() }

  const remove = async (m) => {
    if (!window.confirm(`Remove ${m.name} from ${c.name}? Their reports are kept.`)) return
    try { await api.del(`/api/cohorts/${c.id}/members/${m.id}`); toast(`${m.name} removed`); reloadAll() } catch (err) { toast(err.message, 'bad') }
  }
  const del = async () => {
    if (!window.confirm(`Delete ${c.name}?`)) return
    try { await api.del(`/api/cohorts/${c.id}`); toast('Cohort deleted'); navigate('/cohorts') } catch (err) { toast(err.message, 'bad') }
  }
  const s = dash.data?.summary

  return (
    <>
      <div className="crumbs"><Link to="/cohorts">Cohorts</Link> / {c.name}</div>
      <PageHead title={c.name}
        subtitle={`${c.manager ? `Led by ${c.manager.name}` : 'No lead manager'}${c.start_date ? ` · ${fmtDate(c.start_date)} to ${fmtDate(c.end_date)}` : ''}`}
        actions={<>
          <button className="btn" onClick={() => setModal('edit')}>Edit</button>
          <button className="btn btn-danger-ghost" onClick={del}>Delete</button>
          <button className="btn btn-primary" onClick={() => setModal('add')}>Add trainees</button>
        </>} />
      {c.description && <p className="lead">{c.description}</p>}

      {s && (
        <div className="stats">
          <Stat label="Trainees" value={s.active_trainees} />
          <Stat label="Average progress" value={`${s.avg_progress}%`} />
          <Stat label="At risk" value={s.at_risk} tone={s.at_risk ? 'bad' : undefined} />
          <Stat label="Reports (7 days)" value={s.reports_7d} />
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Members</h2><span className="small muted">{c.members.length}</span></div>
          {c.members.length === 0 ? (
            <EmptyState title="No trainees yet" action={<button className="btn btn-primary" onClick={() => setModal('add')}>Add trainees</button>} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Trainee</th><th>Status</th><th className="w-progress">Progress</th><th>Last report</th><th /></tr></thead>
                <tbody>
                  {c.members.map((m) => {
                    const row = statusById[m.id]
                    return (
                      <tr key={m.id}>
                        <td><div className="person"><Avatar name={m.name} /><div><Link to={`/trainees/${m.id}`}>{m.name}</Link><div className="small muted">{m.email}</div></div></div></td>
                        <td><Badge value={m.status === 'ACTIVE' ? row?.status || 'UNASSIGNED' : 'INACTIVE'} /></td>
                        <td>{row?.plan_count ? <div className="progress-cell"><Progress value={row.progress} size="sm" /><span>{row.progress}%</span></div> : '—'}</td>
                        <td className="small">{timeAgo(row?.last_report_at)}</td>
                        <td className="num"><button className="btn btn-sm btn-ghost" onClick={() => remove(m)}>Remove</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Training plans</h2>
            {user.role === 'MANAGER' && <Link className="btn btn-sm" to={`/plans?new=1&type=COHORT&id=${c.id}`}>New plan</Link>}
          </div>
          {plans.data?.length === 0 ? <EmptyState title="No plans yet">Plans assigned to this cohort show here.</EmptyState> : (
            <ul className="mini-list">
              {(plans.data || []).map((p) => (
                <li key={p.id}>
                  <Link to={`/plans/${p.id}`}>
                    <span><strong>{p.title}</strong><span className="small muted"> · {p.task_count} tasks</span></span>
                    <span className="mini-meta"><span className="small">{p.avg_progress}%</span><Progress value={p.avg_progress} size="xs" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {modal === 'edit' && <CohortModal cohort={c} onClose={() => setModal(null)} onDone={() => { setModal(null); toast('Saved'); reloadAll() }} />}
      {modal === 'add' && <AddMembersModal cohort={c} onClose={() => setModal(null)} onDone={() => { setModal(null); toast('Trainees added and notified'); reloadAll() }} />}
    </>
  )
}
