import { useState } from 'react'
import Spinner from '../../components/Spinner'
import { ErrorBox, Field, Modal } from '../../components/ui'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'

// Pick "a cohort" or "one trainee (solo track)".
export function AssigneePicker({ type, id, onChange }) {
  const cohorts = useApi('/api/cohorts')
  const trainees = useApi('/api/users?role=TRAINEE&status=ACTIVE')
  return (
    <div className="form-grid">
      <Field label="Assign to">
        <div className="seg">
          <button type="button" className={type === 'COHORT' ? 'seg-on' : ''} onClick={() => onChange('COHORT', '')}>A cohort</button>
          <button type="button" className={type === 'TRAINEE' ? 'seg-on' : ''} onClick={() => onChange('TRAINEE', '')}>One trainee (solo)</button>
        </div>
      </Field>
      <Field label={type === 'COHORT' ? 'Cohort' : 'Trainee'}>
        <select value={id} onChange={(e) => onChange(type, e.target.value)}>
          <option value="">Choose…</option>
          {type === 'COHORT'
            ? (cohorts.data || []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.trainee_count})</option>)
            : (trainees.data || []).map((t) => <option key={t.id} value={t.id}>{t.name} · {t.email}</option>)}
        </select>
      </Field>
    </div>
  )
}

const blankTask = () => ({ key: Math.random().toString(36).slice(2), title: '', due_date: '' })

export function PlanModal({ plan, preset, onClose, onDone }) {
  const [title, setTitle] = useState(plan?.title || '')
  const [description, setDescription] = useState(plan?.description || '')
  const [type, setType] = useState(plan?.assignee_type || preset?.type || 'COHORT')
  const [assignee, setAssignee] = useState(plan?.assignee_id || preset?.id || '')
  const [tasks, setTasks] = useState(
    plan?.tasks?.map((t) => ({ key: t.id, id: t.id, title: t.title, due_date: t.due_date || '' })) || [blankTask(), blankTask()],
  )
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const setTask = (i, k, v) => setTasks((ts) => ts.map((t, j) => (j === i ? { ...t, [k]: v } : t)))
  const move = (i, d) => setTasks((ts) => {
    const n = [...ts]; const j = i + d
    if (j < 0 || j >= n.length) return ts
    ;[n[i], n[j]] = [n[j], n[i]]
    return n
  })
  const filled = tasks.filter((t) => t.title.trim())
  const valid = title.trim().length >= 2 && (plan || assignee) && filled.length > 0 && filled.every((t) => t.title.trim().length >= 2)

  const save = async () => {
    setBusy(true); setError(null)
    const taskBody = filled.map((t) => ({ ...(t.id ? { id: t.id } : {}), title: t.title.trim(), due_date: t.due_date || null }))
    try {
      const res = plan
        ? await api.patch(`/api/plans/${plan.id}`, { title, description, tasks: taskBody })
        : await api.post('/api/plans', { title, description, assignee_type: type, assignee_id: assignee, tasks: taskBody })
      onDone(res)
    } catch (err) { setError(err) } finally { setBusy(false) }
  }

  return (
    <Modal wide title={plan ? 'Edit plan' : 'New training plan'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!valid || busy} onClick={save}>{busy ? <Spinner inline /> : plan ? 'Save changes' : 'Create and notify'}</button></>}>
      <ErrorBox error={error} />
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AWS Fundamentals" /></Field>
      <Field label="Description"><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {!plan && <AssigneePicker type={type} id={assignee} onChange={(t, id) => { setType(t); setAssignee(id) }} />}
      <div className="field-label">Tasks</div>
      <ol className="task-editor">
        {tasks.map((t, i) => (
          <li key={t.key}>
            <span className="task-num">{i + 1}</span>
            <input value={t.title} onChange={(e) => setTask(i, 'title', e.target.value)} placeholder="Task title" aria-label={`Task ${i + 1} title`} />
            <input type="date" value={t.due_date} onChange={(e) => setTask(i, 'due_date', e.target.value)} aria-label={`Task ${i + 1} due date`} />
            <div className="task-tools">
              <button type="button" className="icon-btn sm" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>↑</button>
              <button type="button" className="icon-btn sm" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === tasks.length - 1}>↓</button>
              <button type="button" className="icon-btn sm" onClick={() => setTasks((ts) => ts.filter((_, j) => j !== i))} aria-label="Remove task" disabled={tasks.length === 1}>×</button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-sm" onClick={() => setTasks((ts) => [...ts, blankTask()])}>Add task</button>
      {plan && <p className="small muted">Trainees keep progress on tasks you keep. Removing a task removes it from their progress.</p>}
    </Modal>
  )
}

export function CopyPlanModal({ plan, onClose, onDone }) {
  const [type, setType] = useState('COHORT')
  const [id, setId] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true); setError(null)
    try { onDone(await api.post(`/api/plans/${plan.id}/copy`, { assignee_type: type, assignee_id: id })) } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return (
    <Modal title={`Reuse "${plan.title}"`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!id || busy} onClick={save}>{busy ? <Spinner inline /> : 'Copy and notify'}</button></>}>
      <p className="muted">Makes a fresh copy of the tasks for another cohort or trainee. Progress starts at 0.</p>
      <ErrorBox error={error} />
      <AssigneePicker type={type} id={id} onChange={(t, v) => { setType(t); setId(v) }} />
    </Modal>
  )
}