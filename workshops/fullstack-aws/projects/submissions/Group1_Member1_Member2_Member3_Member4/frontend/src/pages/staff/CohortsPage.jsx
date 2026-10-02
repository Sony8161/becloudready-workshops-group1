import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Spinner from '../../components/Spinner'
import { useToast } from '../../components/Toast'
import { EmptyState, ErrorBox, Field, Modal, PageHead } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtShort } from '../../lib/format'
import { useApi } from '../../lib/useApi'

export function CohortModal({ cohort, onClose, onDone }) {
  const managers = useApi('/api/users?role=MANAGER&status=ACTIVE')
  const [form, setForm] = useState({
    name: cohort?.name || '', description: cohort?.description || '', manager_id: cohort?.manager?.id || '',
    start_date: cohort?.start_date || '', end_date: cohort?.end_date || '',
  })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async () => {
    setBusy(true); setError(null)
    const body = { ...form, manager_id: form.manager_id || null, start_date: form.start_date || null, end_date: form.end_date || null }
    try {
      onDone(cohort ? await api.patch(`/api/cohorts/${cohort.id}`, body) : await api.post('/api/cohorts', body))
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return (
    <Modal title={cohort ? 'Edit cohort' : 'New cohort'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || form.name.trim().length < 2} onClick={save}>{busy ? <Spinner inline /> : cohort ? 'Save' : 'Create cohort'}</button></>}>
      <ErrorBox error={error} />
      <div className="form-grid">
        <Field label="Name"><input value={form.name} onChange={set('name')} placeholder="e.g. Cloud Cohort C" /></Field>
        <Field label="Lead manager">
          <select value={form.manager_id} onChange={set('manager_id')}>
            <option value="">No lead yet</option>
            {(managers.data || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Start date"><input type="date" value={form.start_date} onChange={set('start_date')} /></Field>
        <Field label="End date"><input type="date" value={form.end_date} onChange={set('end_date')} /></Field>
      </div>
      <Field label="Description"><textarea rows={3} value={form.description} onChange={set('description')} /></Field>
    </Modal>
  )
}

export default function CohortsPage() {
  const { data, error, loading, reload } = useApi('/api/cohorts')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  return (
    <>
      <PageHead title="Cohorts" subtitle="Groups of trainees who follow the same plans."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}>New cohort</button>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner /> : data?.length === 0 ? (
        <EmptyState title="No cohorts yet" action={<button className="btn btn-primary" onClick={() => setCreating(true)}>Create the first cohort</button>}>
          Cohorts let you assign one plan and one notice to a whole group.
        </EmptyState>
      ) : (
        <div className="card-grid">
          {data?.map((c) => (
            <Link key={c.id} to={`/cohorts/${c.id}`} className="card card-link">
              <h2>{c.name}</h2>
              <p className="muted small clamp-2">{c.description || 'No description'}</p>
              <div className="kv">
                <span>Lead</span><strong>{c.manager?.name || '—'}</strong>
                <span>Trainees</span><strong>{c.trainee_count}</strong>
                <span>Active plans</span><strong>{c.plan_count}</strong>
                <span>Dates</span><strong>{c.start_date ? `${fmtShort(c.start_date)} – ${fmtShort(c.end_date)}` : '—'}</strong>
              </div>
            </Link>
          ))}
        </div>
      )}
      {creating && (
        <CohortModal onClose={() => setCreating(false)}
          onDone={(c) => { setCreating(false); toast(`${c.name} created`); navigate(`/cohorts/${c.id}`) }} />
      )}
    </>
  )
}
